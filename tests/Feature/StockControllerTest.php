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
