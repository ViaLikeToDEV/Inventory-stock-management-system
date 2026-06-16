<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Models\Variant;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IndexedShopee extends Controller
{
    public function queryShopeeData(Request $req)
    {
        $req->validate(['q' => 'required|string']);

        $searchId = trim($req->q);
        $GAS      = config('services.shopee_script_url');
        $GASvproductLine = config('services.products_script_url');

        $searchParameter = [
            'action' => 'query_single',
            str_starts_with(strtoupper($searchId), 'TH')
                ? 'tracking_number'
                : 'order_sn' => $searchId,
        ];

        // ── 1. Transport error ────────────────────────────────────────

        $responses = Http::pool(fn (Pool $pool) => [
            $pool->as('orderSearchRes')->post($GAS, $searchParameter),
            $pool->as('versionCheckerRes')->get($GASvproductLine, ['action' => 'version']),
        ]);

        $response = $responses['orderSearchRes'];
        $versionResponse = $responses['versionCheckerRes'];

        if ($versionResponse->successful()) {
            // ตัดช่องว่าง/ขึ้นบรรทัดใหม่ที่อาจติดมาจาก GAS Text Output ออกให้หมด
            $currentGasVersion = trim($versionResponse->body());

            // ดึงค่า String เวอร์ชันล่าสุดจาก SQLite
            $versionSetting = SystemSetting::where('key', 'shopee_gas_version')->first();

            if ($versionSetting) {
                // 🔍 เทียบค่า String กันตรงๆ เสมอๆ
                if ($versionSetting->value !== $currentGasVersion) {

                Log::info("🚨 Version Changed! Local SQLite was [{$versionSetting->value}], but GAS reported [{$currentGasVersion}]");

                return response()->json([
                    'status' => 'version_changed',
                    'message' => 'ระบบต้องอัพเดตฐานข้อมูล!',
                ], 200);

                    $versionSetting->update([
                        'value' => $currentGasVersion
                    ]);
                }
            } else {
                // เคสฉุกเฉินเผื่อในตารางไม่มีคีย์นี้ (แต่ตอน migration ใส่ไปแล้ว ไม่น่าเจอ)
                SystemSetting::create(['key' => 'gas_version', 'value' => $currentGasVersion]);
            }
        } else {
            Log::error("❌ Cannot fetch version from GAS API.");
        }


        if ($response->failed()) {
            return response()->json([
                'message' => 'เชื่อมต่อ GAS ไม่ได้',
                'detail'  => $response->status() . ' ' . $response->body(),
            ], 502);
        }

        // ── 2. Parse — ป้องกัน GAS คืน HTML / garbage ───────────────
        $resData = $response->object();

        if (json_last_error() !== JSON_ERROR_NONE || !isset($resData->success)) {
            return response()->json([
                'message' => 'GAS คืนข้อมูลที่อ่านไม่ได้',
                'raw'     => $response->body(),   // ← เห็นของจริงเลย
            ], 502);
        }

        // ── 3. GAS บอก success: false ────────────────────────────────
        if ($resData->success !== true) {
            return response()->json([
                'message' => $resData->error       // ← ส่ง error จาก GAS ตรงๆ
                        ?? $resData->message
                        ?? 'GAS ปฏิเสธ request โดยไม่บอกเหตุผล',
            ], 400);
        }

        // ── 4. Success แต่ไม่มี data ─────────────────────────────────
        $gasData = $resData->data ?? null;
        if (!$gasData) {
            return response()->json(['message' => 'GAS ตอบ success แต่ไม่มี data'], 502);
        }

        // ── 5. Data enrichment ────────────────────────────────────────
        $products = $gasData->product_info_sku ?? [];

        $skus = array_map(fn($p) => $p->sku, $products);

        $dbVariants = Variant::with('product')
            ->whereIn('sku', $skus)
            ->get()
            ->keyBy('sku');

        foreach ($products as $product) {
            $variant = $dbVariants->get($product->sku);

            $product->variant_name = $variant?->variant_name         ?? '❌ ไม่พบ SKU นี้ในระบบ';
            $product->product_name = $variant?->product?->product_name ?? '❌ ไม่พบข้อมูล';
            $product->barcode      = $variant?->barcode               ?? null;
            $product->is_active    = $variant?->is_active             ?? false;
        }

        return response()->json([
            'tracking_number' => $gasData->tracking_number ?? null,
            'order_sn'        => $gasData->order_sn        ?? null,
            'products'        => $products,
            'is_packed'       => $gasData->IsPacked        ?? 0,
        ]);
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

            // 1. เช็กกรณีกดซ้ำ (Already Packed) ก่อนเลย
            if (isset($gasResult['already_packed']) && $gasResult['already_packed'] === true) {
                return response()->json([
                    'status' => 'warning', // เปลี่ยนเป็น warning หรือ error ให้สอดคล้อง
                    'message' => 'สินค้าชิ้นนี้ถูกแพ็คแล้ว',
                    'data' => [
                        'tracking_number' => $gasResult['tracking_number'] ?? $req->tracking_number,
                        'packed_at' => $gasResult['packed_at'] ?? now()->toIso8601String()
                    ]
                ], 400); // 👈 ใช้ 400 Bad Request เพราะเป็นข้อผิดพลาดฝั่ง Client ที่ยิงซ้ำ
            }

            // 2. ส่งผลลัพธ์กรณีอัปเดตสำเร็จจริงๆ
            if (isset($gasResult['success']) && $gasResult['success'] === true) {
                return response()->json([
                    'status' => 'success',
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
