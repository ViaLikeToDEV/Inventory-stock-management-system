<?php

namespace App\Http\Controllers;

use App\Models\Variant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StockController extends Controller
{
    public function catalog()
    {
        $items = Variant::query()
            ->where('is_active', true)
            ->whereNotNull('barcode')
            ->where('barcode', '!=', '')
            ->with('product')
            ->get()
            ->map(fn (Variant $variant) => [
                'barcode' => $variant->barcode,
                'productName' => $variant->product?->product_name ?? '',
                'sku' => $variant->sku,
                'variantName' => $variant->variant_name,
            ])
            ->values();

        return response()->json(['success' => true, 'data' => $items]);
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
