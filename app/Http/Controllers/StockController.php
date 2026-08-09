<?php

namespace App\Http\Controllers;

use App\Models\Variant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StockController extends Controller
{
    public function catalog()
    {
        $activeVariants = Variant::query()->where('is_active', true)->with('product')->get();

        $items = $activeVariants
            ->filter(fn (Variant $variant) => filled($variant->barcode))
            ->map(fn (Variant $variant) => [
                'barcode' => $variant->barcode,
                'productName' => $variant->product?->product_name ?? '',
                'sku' => $variant->sku,
                'variantName' => $variant->variant_name,
            ])
            ->values();

        $seenBarcodes = $items->pluck('barcode')->flip();

        foreach ($activeVariants as $variant) {
            foreach ($this->decodeBundle($variant->bundle) as $entry) {
                if (($entry['type'] ?? null) !== 'dummy_item' || empty($entry['barcode'])) {
                    continue;
                }

                if ($seenBarcodes->has($entry['barcode'])) {
                    continue;
                }

                $items->push([
                    'barcode' => $entry['barcode'],
                    'productName' => $entry['display_product_name'] ?? '',
                    'sku' => '',
                    'variantName' => $entry['display_variant'] ?? '',
                ]);

                $seenBarcodes->put($entry['barcode'], true);
            }
        }

        return response()->json(['success' => true, 'data' => $items->values()]);
    }

    /**
     * ตรวจสอบความสมบูรณ์ของข้อมูล bundle (ของแถม/ชุดสินค้า) ใน Variant ที่ active อยู่เท่านั้น
     * ตรวจแค่ origin_sku ที่ bundle อ้างอิงไม่มีอยู่จริงในบรรดา Variant ที่ active — เพราะ sku คือ
     * join key ที่ resolveOrderBarcodeQuantities ใช้จริงตอนแพ็ค ผิดแล้วเบรกของจริง
     * ส่วน display_product_name/display_variant เป็นแค่ label โชว์ให้ Packer ดู ไม่กระทบการทำงาน
     * จึงไม่ถือเป็นปัญหาความสมบูรณ์ของข้อมูล แม้จะพิมพ์ไม่ตรงกันในหลาย bundle ก็ตาม
     *
     * @return array<int, array<string, mixed>>
     */
    public function integrityIssues()
    {
        $activeVariants = Variant::query()->where('is_active', true)->get()->keyBy('sku');

        $issues = [];

        foreach ($activeVariants as $variant) {
            foreach ($this->decodeBundle($variant->bundle) as $entry) {
                if (($entry['type'] ?? null) !== 'origin_sku') {
                    continue;
                }

                $refSku = $entry['sku'] ?? null;

                if (! $refSku || ! $activeVariants->has($refSku)) {
                    $issues[] = [
                        'type' => 'broken_origin_ref',
                        'variantSku' => $variant->sku,
                        'variantName' => $variant->variant_name,
                        'referencedSku' => $refSku,
                        'message' => "Bundle \"{$variant->variant_name}\" ({$variant->sku}) อ้างอิง origin_sku \"{$refSku}\" ที่ไม่พบใน Variant ที่ active อยู่",
                    ];
                }
            }
        }

        return response()->json(['success' => true, 'data' => $issues]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function decodeBundle(?string $bundleJson): array
    {
        if (! $bundleJson) {
            return [];
        }

        $decoded = json_decode($bundleJson, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function bulkSyncStock(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.barcode' => 'required|string',
            'items.*.productName' => 'nullable|string',
            'items.*.count' => 'nullable|numeric',
        ]);

        $gasUrl = config('services.stock_script_url');

        try {
            $response = Http::timeout(20)->post($gasUrl, [
                'action' => 'bulk-upsert-stock',
                'items' => $validated['items'],
            ]);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function fetchStocks()
    {
        $gasUrl = config('services.stock_script_url');

        try {
            $response = Http::timeout(20)->get($gasUrl, ['action' => 'get-stocks']);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function addStock(Request $request)
    {
        $gasUrl = config('services.stock_script_url');

        $payload = $request->all();
        $payload['action'] = 'add-stock';

        try {
            $response = Http::timeout(20)->post($gasUrl, $payload);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function editStock(Request $request)
    {
        $gasUrl = config('services.stock_script_url');

        $payload = $request->all();
        $payload['action'] = 'edit-stock';

        try {
            $response = Http::timeout(20)->post($gasUrl, $payload);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function deleteStock(Request $request)
    {
        $validated = $request->validate([
            'barcode' => 'required|string',
        ]);

        $gasUrl = config('services.stock_script_url');

        try {
            $response = Http::timeout(20)->post($gasUrl, [
                'action' => 'delete-stock',
                'barcode' => $validated['barcode'],
            ]);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
