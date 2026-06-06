<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Variant;
use Illuminate\Support\Facades\Http;


class IndexedShopee extends Controller
{
    public function queryShopeeData(Request $req)
    {
        $req->validate([
            'q' => 'required|string'
        ]);

        $searchId = trim($req->q);
        $GAS = config('services.shopee_script_url');

        // --- เริ่ม LOGIC แยก PARAMETER ตาม PREFIX ---
        $searchParameter = [
            'action' => 'query_single'
        ];

        // เช็คว่าขึ้นต้นด้วย TH ไหม (Case-sensitive หรือใส่ strtoupper เผื่อผู้ใช้พิมพ์ th เล็กมา)
        if (str_starts_with(strtoupper($searchId), 'TH')) {
            $searchParameter['tracking_number'] = $searchId;
        } else {
            $searchParameter['order_sn'] = $searchId;
        }
        // --- จบ LOGIC แยก PARAMETER ---

        $response = Http::timeout(15)->post($GAS, $searchParameter);

        if ($response->failed()) {
            return response()->json(['message' => 'cannot connect to GAS'], 500);
        }

        $resData = $response->object();

        // 1. เช็คกรณีหาไม่เจอ
        if (isset($resData->message) && $resData->message === 'Query not matched'){
            return response()->json(['message' => 'หาออเดอร์ไม่เจอนะออเจ้า:P'], 400);
        }

        // 2. เช็ค Success ด้วย Boolean ตาม JSON
        if (isset($resData->success) && $resData->success === true) {

            $gasData = $resData->data ?? null;
            if (!$gasData) {
                return response()->json(['message' => 'Data payload is missing'], 400);
            }

            $trackingNumber = $gasData->tracking_number ?? null;
            $orderSn        = $gasData->order_sn ?? null;
            $products       = $gasData->product_info_sku ?? [];
            $isPacked       = $gasData->IsPacked ?? 0;

            // --- DATA ENRICHMENT ---
            $skus = array_map(function($product) {
                return $product->sku;
            }, $products);

            $dbVariants = Variant::with('product')
                ->whereIn('sku', $skus)
                ->get()
                ->keyBy('sku');

            foreach ($products as $product) {
                $sku = $product->sku;
                $variantInfo = $dbVariants->get($sku);

                if ($variantInfo) {
                    $product->variant_name = $variantInfo->variant_name;
                    $product->product_name = $variantInfo->product?->product_name ?? 'ไม่มีชื่อสินค้าหลัก';
                    $product->barcode      = $variantInfo->barcode;
                    $product->is_active    = $variantInfo->is_active;
                } else {
                    $product->variant_name = '❌ ไม่พบข้อมูล SKU นี้ในระบบ';
                    $product->product_name = '❌ ไม่พบข้อมูล';
                    $product->barcode      = null;
                    $product->is_active    = false;
                }
            }
            // --- จบ DATA ENRICHMENT ---

            $prepareRes = [
                'tracking_number' => $trackingNumber,
                'order_sn'        => $orderSn,
                'products'        => $products,
                'is_packed'       => $isPacked
            ];

            return response()->json($prepareRes);
        }

        return response()->json(['message' => 'Invalid status from GAS'], 400);
    }

    public function setpacked(Request $req)
    {
        // 1. Validate ข้อมูลที่ส่งมาจาก React (เปลี่ยนให้บังคับ tracking_number ตามที่ GAS ต้องการ)
        $req->validate([
            'tracking_number' => 'required|string',
            'order_sn' => 'nullable|string', // จะมีหรือไม่มีก็ได้ เพราะ GAS ใช้ tracking เป็นหลักในการหา index
        ]);

        $GAS_URL = config('services.shopee_script_url');

        if (!$GAS_URL) {
            return response()->json([
                'status' => 'error',
                'message' => 'ไม่พบโครงสร้างบริการ GAS ในระบบ Config'
            ], 500);
        }

        // 2. จัดโครงสร้าง Payload ให้ตรงตามที่ GAS คาดหวัง
        $payload = [
            'action' => 'pack',
            'tracking_number' => $req->tracking_number,
        ];

        try {
            // 3. ยิง HTTP POST ไปที่ Google Apps Script
            // เผื่อเวลา timeout ไว้หน่อย เพราะ GAS โคตรช้าเวลาติด LockService
            $response = Http::timeout(15)->post($GAS_URL, $payload);

            if ($response->failed()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Google Apps Script ไม่ตอบกลับหรือเกิดข้อผิดพลาดทางเครือข่าย'
                ], 502);
            }

            // แกะ JSON ที่ GAS ส่งกลับมา
            $gasResult = $response->json();

            // 4. ส่งผลลัพธ์กลับไปให้ฝั่ง React จัดการต่อ
            // เช็ก key 'success' แบบ Boolean ตามที่ GAS พ่นออกมา
            if (isset($gasResult['success']) && $gasResult['success'] === true) {
                return response()->json([
                    'status' => 'success',
                    // ถ้า GAS ไม่มี message กลับมา ให้ fallback เป็นข้อความ Default
                    'message' => $gasResult['message'] ?? 'อัปเดตสถานะแพ็คสินค้าเรียบร้อย',
                    'data' => [
                        'tracking_number' => $gasResult['tracking_number'] ?? $req->tracking_number,
                        'packed_at' => $gasResult['packed_at'] ?? now()->toIso8601String()
                    ]
                ], 200);
            }

            // กรณี GAS พ่น error ออกมา (success: false)
            return response()->json([
                'status' => 'error',
                'message' => $gasResult['error'] ?? 'GAS ปฏิเสธการอัปเดตข้อมูล'
            ], 400);

        } catch (\Exception $e) {
            Log::error('GAS Packing Update Error: ' . $e->getMessage());

            return response()->json([
                'status' => 'error',
                'message' => 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์: ' . $e->getMessage()
            ], 500);
        }
    }
}
