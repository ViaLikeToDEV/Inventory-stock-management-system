<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Models\Variant;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Artisan;
use GuzzleHttp\Promise\Utils;

class IndexedShopee extends Controller
{
    private const GAS_VERSION_KEY = 'shopee_gas_version';

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

        $orderSearchPromise = Http::async()->post($GAS, $searchParameter);
        $versionCheckerPromise = Http::async()->get($GASvproductLine, ['action' => 'version']);

        // สร้างตัวแปรไว้เก็บสถานะเผื่อเกิดเหตุการณ์เวอร์ชันไม่ตรง
        $versionMismatchDetected = false;

        // ⚡ ดักจัดการตัว versionChecker ทันทีที่มันตอบกลับมา (ไม่ต้องรอออเดอร์)
        $versionCheckerPromise->then(function ($versionResponse) use (&$versionMismatchDetected) {
            if ($versionResponse->successful()) {
                $currentGasVersion = trim($versionResponse->body());
                $versionSetting = SystemSetting::where('key', self::GAS_VERSION_KEY)->first();

                if ($versionSetting) {
                    // 🚨 ตรวจพบว่าเวอร์ชันมีการเปลี่ยนแปลง
                    if ($versionSetting->value !== $currentGasVersion) {
                        Log::info("🚨 Version Changed! Local SQLite was [{$versionSetting->value}], but GAS reported [{$currentGasVersion}]");

                        $versionMismatchDetected = true;

                        // 🛠️ [ต่อท่อตรงไป src 4] รันเครื่องมืออัปเดตฐานข้อมูลทันทีแบบไร้รอยต่อ
                        try {
                            Artisan::call('db:seed', [
                                '--class' => 'ProductSeeder',
                                '--force' => true,
                            ]);
                            Log::info("✅ Auto-sync products database completed via Seeder.");

                        } catch (\Exception $e) {
                            Log::error("❌ Auto-sync failed: " . $e->getMessage());
                        }
                    }
                } else {
                    SystemSetting::create(['key' => self::GAS_VERSION_KEY, 'value' => $currentGasVersion]);
                }
            } else {
                Log::error("❌ Cannot fetch version from GAS API.");
            }
        });

        try {
            // รอจนกว่าทั้งคู่จะประมวลผลเสร็จ (ฝั่ง version ทำ Logic ด้านบนเสร็จเรียบร้อยแล้ว)
            $results = Utils::all([
                'orderSearch' => $orderSearchPromise,
                'versionChecker' => $versionCheckerPromise,
            ])->wait();

            // ดึงค่า Response ของตัวสั่งออเดอร์มาทำงานต่อ
            $response = $results['orderSearch'];

        } catch (\Throwable $e) {
            Log::error("❌ Request Error in pool processing: " . $e->getMessage());
            return response()->json([
                'message' => 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย',
                'detail'  => $e->getMessage(),
            ], 500);
        }

        // เช็คผลลัพธ์ของ orderSearch ต่อด้านล่างทันทีแบบ Seamless
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
                'raw'     => $response->body(),
            ], 502);
        }

        // ── 3. GAS บอก success: false ────────────────────────────────
        if ($resData->success !== true) {
            return response()->json([
                'message' => $resData->error
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

        $temp_product_storage = [];

        foreach ($products as $key => $product) {
            $variant = $dbVariants->get($product->sku);
            $bundle = $variant?->bundle ?? null;

            if ($bundle) {
                $actual_product_quantity = $product->quantity ?? null;
                $origin_product = $product ?? null;
                $bundle_data = json_decode($bundle);

                foreach ($bundle_data as $index_value => $bundle_obj) {
                    if ($bundle_obj && ($bundle_obj->type === 'origin_sku')) {
                        $origin_sku = Variant::where('sku', $bundle_obj->sku)->first();
                        $newProduct = new \stdClass();
                        $newProduct->sku          = "{$origin_product->sku}_{$index_value}_{$bundle_obj?->sku}";
                        $newProduct->variant_name = $bundle_obj?->display_variant ?? $origin_sku?->variant_name ?? '❌ ไม่พบ Origin_SKU นี้ในระบบ';
                        $newProduct->product_name = $bundle_obj?->display_product_name ?? $origin_sku?->product?->product_name ?? '❌ ไม่พบข้อมูล';
                        $newProduct->barcode      = $origin_sku?->barcode ?? null;
                        $newProduct->is_active    = $origin_sku?->is_active ?? false;
                        $newProduct->quantity     = isset($bundle_obj?->quantity) ? $actual_product_quantity * $bundle_obj->quantity : 0;

                        $temp_product_storage[] = $newProduct;
                    } elseif ($bundle_obj && ($bundle_obj->type === 'dummy_item')) {
                        $newProduct = new \stdClass();
                        $newProduct->sku          = "{$origin_product->sku}_{$index_value}_{$bundle_obj?->display_variant}";
                        $newProduct->variant_name = $bundle_obj?->display_variant ?? '❌ ไม่พบ dummy_item_variant ในระบบ';
                        $newProduct->product_name = $bundle_obj?->display_product_name ?? '❌ ไม่พบข้อมูล';
                        $newProduct->barcode      = $bundle_obj?->barcode ?? null;
                        $newProduct->is_active    = true;
                        $newProduct->quantity     = isset($bundle_obj?->quantity) && isset($actual_product_quantity) ? $actual_product_quantity * $bundle_obj->quantity : 0;
                        $temp_product_storage[] = $newProduct;
                    }
                }
            } else {
                $product->variant_name = $variant?->variant_name ?? '❌ ไม่พบ SKU นี้ในระบบ';
                $product->product_name = $variant?->product?->product_name ?? '❌ ไม่พบข้อมูล';
                $product->barcode      = $variant?->barcode ?? null;
                $product->is_active    = $variant?->is_active ?? false;
                $temp_product_storage[] = $product;
            }
        }

        $products = $temp_product_storage;

        // คืนค่าผลลัพธ์ของ Order กลับไปตามปกติแบบไร้รอยต่อ โดยแอบทำงานซีดข้อมูลไว้เบื้องหลังเรียบร้อยแล้ว
        return response()->json([
            'tracking_number' => $gasData->tracking_number ?? null,
            'order_sn'        => $gasData->order_sn        ?? null,
            'products'        => $products,
            'is_packed'       => $gasData->IsPacked        ?? 0,
            // (Optional) แนบ flag ไปบอกหน้าบ้านได้เผื่ออยากโชว์ Alert เพิ่มเติมทีหลัง
            'db_auto_synced'  => $versionMismatchDetected ?? false,
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
