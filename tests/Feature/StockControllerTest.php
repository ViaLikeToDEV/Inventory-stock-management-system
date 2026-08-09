<?php

use App\Models\Product;
use App\Models\Variant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

it('proxies fetch-stocks to the stock GAS script', function () {
    config(['services.stock_script_url' => 'https://example.test/stock-gas']);

    Http::fake([
        'https://example.test/stock-gas*' => Http::response([
            'success' => true,
            'data' => [
                ['barcode' => '1234567890123', 'productName' => 'Test Product', 'count' => 10],
            ],
        ]),
    ]);

    $response = $this->getJson('/api/stock-api/stocks');

    $response->assertOk()->assertJson([
        'success' => true,
        'data' => [
            ['barcode' => '1234567890123', 'productName' => 'Test Product', 'count' => 10],
        ],
    ]);

    Http::assertSent(fn ($request) => $request->url() === 'https://example.test/stock-gas?action=get-stocks');
});

it('proxies add-stock to the stock GAS script with the action injected', function () {
    config(['services.stock_script_url' => 'https://example.test/stock-gas']);

    Http::fake([
        'https://example.test/stock-gas*' => Http::response(['status' => 'success']),
    ]);

    $response = $this->postJson('/api/stock-api/add-stock', [
        'barcode' => '1234567890123',
        'productName' => 'Test Product',
        'count' => 5,
    ]);

    $response->assertOk()->assertJson(['status' => 'success']);

    Http::assertSent(fn ($request) => $request['action'] === 'add-stock' && $request['barcode'] === '1234567890123');
});

it('returns the active variant catalog from sqlite without calling the GAS script', function () {
    Product::create(['product_id' => 1, 'product_name' => 'Test Product', 'is_active' => true]);
    Variant::create([
        'sku' => 'SKU-001',
        'product_id' => 1,
        'variant_name' => 'Default',
        'barcode' => '1234567890123',
        'is_active' => true,
    ]);
    Variant::create([
        'sku' => 'SKU-002',
        'product_id' => 1,
        'variant_name' => 'Inactive',
        'barcode' => '9999999999999',
        'is_active' => false,
    ]);
    Variant::create([
        'sku' => 'SKU-003',
        'product_id' => 1,
        'variant_name' => 'No barcode',
        'barcode' => null,
        'is_active' => true,
    ]);

    Http::fake();

    $response = $this->getJson('/api/stock-api/catalog');

    $response->assertOk()->assertJson([
        'success' => true,
        'data' => [
            ['barcode' => '1234567890123', 'productName' => 'Test Product'],
        ],
    ]);

    expect($response->json('data'))->toHaveCount(1);
    Http::assertNothingSent();
});

it('merges dummy_item bundle components from active variants into the catalog', function () {
    Product::create(['product_id' => 1, 'product_name' => 'Real Product', 'is_active' => true]);
    Product::create(['product_id' => 2, 'product_name' => 'Bundle Product', 'is_active' => true]);

    Variant::create([
        'sku' => 'SKU-001',
        'product_id' => 1,
        'variant_name' => 'Default',
        'barcode' => '1234567890123',
        'is_active' => true,
    ]);

    Variant::create([
        'sku' => 'SKU-BUNDLE',
        'product_id' => 2,
        'variant_name' => 'Bundle Set',
        'barcode' => null,
        'is_active' => true,
        'bundle' => json_encode([
            ['type' => 'origin_sku', 'sku' => 'SKU-001', 'quantity' => 1],
            ['type' => 'dummy_item', 'quantity' => 1, 'barcode' => 'DUMMY-001', 'display_product_name' => 'Free Rice', 'display_variant' => 'Rice Bag'],
        ]),
    ]);

    Variant::create([
        'sku' => 'SKU-INACTIVE-BUNDLE',
        'product_id' => 2,
        'variant_name' => 'Old Bundle',
        'barcode' => null,
        'is_active' => false,
        'bundle' => json_encode([
            ['type' => 'dummy_item', 'quantity' => 1, 'barcode' => 'DUMMY-INACTIVE', 'display_product_name' => 'Ghost Item', 'display_variant' => 'Ghost'],
        ]),
    ]);

    Http::fake();

    $response = $this->getJson('/api/stock-api/catalog');

    $response->assertOk();
    $data = collect($response->json('data'));

    expect($data->pluck('barcode'))->toContain('1234567890123', 'DUMMY-001')
        ->not->toContain('DUMMY-INACTIVE');

    $dummyRow = $data->firstWhere('barcode', 'DUMMY-001');
    expect($dummyRow['productName'])->toBe('Free Rice');
    expect($dummyRow['sku'])->toBe('');
});

it('reports broken origin_sku references among active variants as an integrity issue', function () {
    Product::create(['product_id' => 1, 'product_name' => 'Bundle Product', 'is_active' => true]);

    Variant::create([
        'sku' => 'SKU-BROKEN',
        'product_id' => 1,
        'variant_name' => 'Broken Bundle',
        'barcode' => null,
        'is_active' => true,
        'bundle' => json_encode([
            ['type' => 'origin_sku', 'sku' => 'DOES-NOT-EXIST', 'quantity' => 1],
        ]),
    ]);

    $response = $this->getJson('/api/stock-api/integrity-issues');

    $response->assertOk();
    $issues = collect($response->json('data'));

    expect($issues->firstWhere('type', 'broken_origin_ref')['referencedSku'])->toBe('DOES-NOT-EXIST');
});

it('does not flag dummy_item barcodes with differing display names across bundles, since those are packer-facing labels only', function () {
    Product::create(['product_id' => 1, 'product_name' => 'Bundle A', 'is_active' => true]);
    Product::create(['product_id' => 2, 'product_name' => 'Bundle B', 'is_active' => true]);

    Variant::create([
        'sku' => 'SKU-BUNDLE-A',
        'product_id' => 1,
        'variant_name' => 'Bundle A',
        'barcode' => null,
        'is_active' => true,
        'bundle' => json_encode([
            ['type' => 'dummy_item', 'quantity' => 1, 'barcode' => 'SHARED-DUMMY', 'display_product_name' => 'Rice', 'display_variant' => 'Small'],
        ]),
    ]);

    Variant::create([
        'sku' => 'SKU-BUNDLE-B',
        'product_id' => 2,
        'variant_name' => 'Bundle B',
        'barcode' => null,
        'is_active' => true,
        'bundle' => json_encode([
            ['type' => 'dummy_item', 'quantity' => 1, 'barcode' => 'SHARED-DUMMY', 'display_product_name' => 'Rice', 'display_variant' => 'Large'],
        ]),
    ]);

    $response = $this->getJson('/api/stock-api/integrity-issues');

    $response->assertOk();
    expect($response->json('data'))->toBe([]);
});

it('proxies delete-stock to the stock GAS script with the action injected', function () {
    config(['services.stock_script_url' => 'https://example.test/stock-gas']);

    Http::fake([
        'https://example.test/stock-gas*' => Http::response(['status' => 'success']),
    ]);

    $response = $this->postJson('/api/stock-api/delete-stock', [
        'barcode' => '1234567890123',
    ]);

    $response->assertOk()->assertJson(['status' => 'success']);

    Http::assertSent(fn ($request) => $request['action'] === 'delete-stock' && $request['barcode'] === '1234567890123');
});

it('requires a barcode to delete stock', function () {
    config(['services.stock_script_url' => 'https://example.test/stock-gas']);

    Http::fake();

    $response = $this->postJson('/api/stock-api/delete-stock', []);

    $response->assertStatus(422);
    Http::assertNothingSent();
});

it('proxies bulk-sync to the stock GAS script with items forwarded', function () {
    config(['services.stock_script_url' => 'https://example.test/stock-gas']);

    Http::fake([
        'https://example.test/stock-gas*' => Http::response(['status' => 'success', 'inserted' => 1, 'updated' => 1]),
    ]);

    $items = [
        ['barcode' => '1234567890123', 'productName' => 'New Product', 'count' => 0],
        ['barcode' => '2222222222222', 'productName' => 'Renamed Product', 'count' => 4],
    ];

    $response = $this->postJson('/api/stock-api/bulk-sync', ['items' => $items]);

    $response->assertOk()->assertJson(['status' => 'success']);

    Http::assertSent(fn ($request) => $request['action'] === 'bulk-upsert-stock' && $request['items'] === $items);
});
