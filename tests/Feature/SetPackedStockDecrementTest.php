<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Variant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    config([
        'services.shopee_script_url' => 'https://example.test/shopee-gas',
        'services.stock_script_url' => 'https://example.test/stock-gas',
    ]);

    Product::create(['product_id' => 1, 'product_name' => 'Test Product', 'is_active' => true]);
    Variant::create([
        'sku' => 'SKU-001',
        'product_id' => 1,
        'variant_name' => 'Default',
        'barcode' => '1234567890123',
        'is_active' => true,
    ]);

    $this->order = Order::create([
        'tracking_number' => 'TH-TEST-001',
        'order_sn' => 'SN-TEST-001',
        'timestamp' => now(),
        'is_packed' => false,
        'is_active' => true,
    ]);

    OrderItem::create([
        'order_id' => $this->order->id,
        'sku' => 'SKU-001',
        'quantity' => 3,
        'price' => 100,
    ]);
});

it('decrements stock by barcode after a successful GAS pack', function () {
    Http::fake([
        'https://example.test/shopee-gas' => Http::response(['success' => true, 'tracking_number' => 'TH-TEST-001']),
        'https://example.test/stock-gas*' => Http::sequence()
            ->push(['success' => true, 'data' => [['barcode' => '1234567890123', 'productName' => 'Test Product', 'count' => 10]]])
            ->push(['success' => true, 'count' => 7]),
    ]);

    $response = $this->postJson('/api/shopee-api/set-packed', ['tracking_number' => 'TH-TEST-001']);

    $response->assertOk();
    expect($this->order->fresh()->is_packed)->toBeTrue();

    Http::assertSent(fn ($request) => $request->url() === 'https://example.test/stock-gas'
        && $request['action'] === 'decrement-stock'
        && $request['barcode'] === '1234567890123'
        && $request['quantity'] === 3);
});

it('does not fail the pack response when the stock GAS call fails', function () {
    Http::fake([
        'https://example.test/shopee-gas' => Http::response(['success' => true, 'tracking_number' => 'TH-TEST-001']),
        'https://example.test/stock-gas*' => Http::response([], 500),
    ]);

    $response = $this->postJson('/api/shopee-api/set-packed', ['tracking_number' => 'TH-TEST-001']);

    $response->assertOk()->assertJson(['status' => 'success']);
    expect($this->order->fresh()->is_packed)->toBeTrue();
});

it('fails open and allows packing when the stock GAS is unreachable during the pre-check', function () {
    // both the pre-check GET and the post-pack decrement POST fail
    Http::fake([
        'https://example.test/shopee-gas' => Http::response(['success' => true, 'tracking_number' => 'TH-TEST-001']),
        'https://example.test/stock-gas*' => Http::response([], 500),
    ]);

    $response = $this->postJson('/api/shopee-api/set-packed', ['tracking_number' => 'TH-TEST-001']);

    $response->assertOk()->assertJson(['status' => 'success']);
    expect($this->order->fresh()->is_packed)->toBeTrue();
});

it('blocks packing when stock is insufficient', function () {
    Http::fake([
        'https://example.test/shopee-gas' => Http::response(['success' => true, 'tracking_number' => 'TH-TEST-001']),
        'https://example.test/stock-gas*' => Http::response(['success' => true, 'data' => [
            ['barcode' => '1234567890123', 'productName' => 'Test Product', 'count' => 1],
        ]]),
    ]);

    $response = $this->postJson('/api/shopee-api/set-packed', ['tracking_number' => 'TH-TEST-001']);

    $response->assertStatus(400)->assertJson(['status' => 'warning']);
    expect($response->json('data.shortages.0'))->toMatchArray([
        'sku' => '1234567890123',
        'barcode' => '1234567890123',
        'required' => 3,
        'available' => 1,
    ]);
    expect($this->order->fresh()->is_packed)->toBeFalse();

    Http::assertNotSent(fn ($request) => $request->url() === 'https://example.test/shopee-gas');
});

it('blocks packing when the SKU has no barcode tracked in the stock system', function () {
    Http::fake([
        'https://example.test/shopee-gas' => Http::response(['success' => true, 'tracking_number' => 'TH-TEST-001']),
        'https://example.test/stock-gas*' => Http::response(['success' => true, 'data' => []]),
    ]);

    Variant::where('sku', 'SKU-001')->update(['barcode' => null]);

    $response = $this->postJson('/api/shopee-api/set-packed', ['tracking_number' => 'TH-TEST-001']);

    $response->assertStatus(400)->assertJson(['status' => 'warning']);
    expect($this->order->fresh()->is_packed)->toBeFalse();

    Http::assertNotSent(fn ($request) => $request->url() === 'https://example.test/shopee-gas');
});

it('expands bundle SKUs into their component barcodes for both the check and the decrement', function () {
    Variant::create([
        'sku' => 'SKU-COMPONENT',
        'product_id' => 1,
        'variant_name' => 'Component',
        'barcode' => '2222222222222',
        'is_active' => true,
    ]);

    Variant::create([
        'sku' => 'SKU-BUNDLE',
        'product_id' => 1,
        'variant_name' => 'Bundle',
        'barcode' => null,
        'is_active' => true,
        'bundle' => json_encode([
            ['type' => 'origin_sku', 'sku' => 'SKU-COMPONENT', 'quantity' => 2, 'display_variant' => 'Component'],
            ['type' => 'dummy_item', 'barcode' => '3333333333333', 'quantity' => 1, 'display_variant' => 'Dummy'],
        ]),
    ]);

    OrderItem::create([
        'order_id' => $this->order->id,
        'sku' => 'SKU-BUNDLE',
        'quantity' => 2,
        'price' => 50,
    ]);

    Http::fake([
        'https://example.test/shopee-gas' => Http::response(['success' => true, 'tracking_number' => 'TH-TEST-001']),
        'https://example.test/stock-gas*' => Http::sequence()
            ->push(['success' => true, 'data' => [
                ['barcode' => '1234567890123', 'productName' => 'Test Product', 'count' => 10],
                ['barcode' => '2222222222222', 'productName' => 'Component', 'count' => 10],
                ['barcode' => '3333333333333', 'productName' => 'Dummy', 'count' => 10],
            ]])
            ->push(['success' => true])
            ->push(['success' => true])
            ->push(['success' => true]),
    ]);

    $response = $this->postJson('/api/shopee-api/set-packed', ['tracking_number' => 'TH-TEST-001']);

    $response->assertOk();
    expect($this->order->fresh()->is_packed)->toBeTrue();

    // SKU-BUNDLE quantity 2 * bundle entry quantity 2 = 4 units of the component barcode
    Http::assertSent(fn ($request) => $request->url() === 'https://example.test/stock-gas'
        && ($request['action'] ?? null) === 'decrement-stock'
        && $request['barcode'] === '2222222222222'
        && $request['quantity'] === 4);

    // SKU-BUNDLE quantity 2 * dummy_item quantity 1 = 2 units of the dummy barcode
    Http::assertSent(fn ($request) => $request->url() === 'https://example.test/stock-gas'
        && ($request['action'] ?? null) === 'decrement-stock'
        && $request['barcode'] === '3333333333333'
        && $request['quantity'] === 2);
});
