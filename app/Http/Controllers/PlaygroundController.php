<?php

namespace App\Http\Controllers;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\Product;
use App\Models\Variant;

class PlaygroundController extends Controller
{

    public function page(){
        return inertia::render('pg');
    }

    public function SendThemAndSendBack(){
        $someobj = [
            "message" => "hello world",
            "nested1" => [
                "item1" => "this is text from item1",
                "item2" => "this is text from item2",
            ]
        ];

        $res = Http::post('https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec', $someobj);

        return $res;
    }

    public function queryShopeeData(Request $req)
    {

    $req->validate([
        'q' => 'required|string'
    ]);

        $searchId = trim($req->q);
        $GAS = 'https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec';

        $searchParameter = [
            'action' => 'query',
            'qarguement' => $searchId,
        ];

        $response = Http::timeout(15)->post($GAS, $searchParameter);

        if ($response->failed()) {
            return response()->json(['message' => 'cannot connect to GAS'], 500);
        }


        $resData = $response->object();

        if (isset($resData->message) && $resData->message  === 'Query not matched'){
            return response()->json(['message' => 'หาออเดอร์ไม่เจอนะออเจ้า:P'], 400);
        }

        if (isset($resData->status) && $resData->status === 'success') {
            $matching = $resData->matching;

            $trackingNumber = $matching[0] ?? null;
            $orderSn        = $matching[1] ?? null;
            $products       = $matching[2] ?? [];
            $timestamp      = $matching[3] ?? null;
            $isPacked       = $matching[4] ?? 0;

            // --- เริ่มกระบวนการ DATA ENRICHMENT ---

            // 1. ดึงเฉพาะ sku ทั้งหมดจากตระกูล $products ออกมาเป็น Array
            $skus = array_column($products, 'sku');

            // 2. Query ข้อมูลจาก DB รอบเดียว โดยดึง Variant พ่วง Product (Relation) มาด้วย
            // ใช้ keyBy เพื่อให้สามารถดึงข้อมูลผ่าน $dbVariants[$sku] ได้ทันที ไม่ต้องไปวนลูปหาซ้ำ
            $dbVariants = Variant::with('product')
                ->whereIn('sku', $skus)
                ->get()
                ->keyBy('sku');

            // 3. วนลูปเพื่อเติมเต็มข้อมูล (Enrichment)
            foreach ($products as $product) {
                $sku = $product->sku;

                // หาข้อมูลในตารางคลังของเราว่ามี SKU นี้ไหม
                $variantInfo = $dbVariants->get($sku);

                if ($variantInfo) {
                    // ยัดข้อมูลจาก DB เพิ่มเข้าไปใน Object ของ GAS
                    $product->variant_name = $variantInfo->variant_name;
                    $product->product_name = $variantInfo->product?->product_name ?? 'ไม่มีชื่อสินค้าหลัก';
                    $product->barcode      = $variantInfo->barcode;
                    $product->is_active    = $variantInfo->is_active; // เอาไว้เช็คว่าสินค้านี้ยังขายอยู่ไหม
                } else {
                    // เผื่อกรณีที่ SKU ใน Sheet สะกดผิด หรือไม่มีในระบบ DB
                    $product->variant_name = '❌ ไม่พบข้อมูล SKU นี้ในระบบ';
                    $product->product_name = '❌ ไม่พบข้อมูล';
                    $product->barcode      = null;
                    $product->is_active    = false;
                }
            }

            // --- จบกระบวนการ DATA ENRICHMENT ---

            $prepareRes = [
                'tracking_number' => $trackingNumber,
                'order_sn' => $orderSn,
                'products' => $products, // ตอนนี้ข้อมูลข้างในจะมี variant_name, product_name, barcode โผล่มาแล้ว
                'is_packed' => $isPacked
            ];

            return response()->json($prepareRes);
        }

        return response()->json(['message' => 'Invalid status from GAS'], 400);
        }

        public function setpacked(Request $req)
        {
            // 1. Validate ข้อมูลที่ส่งมาจาก React (ยอมให้ส่ง tracking_number มาด้วย)
            $req->validate([
                'order_sn' => 'required|string',
                'tracking_number' => 'nullable|string',
            ]);

            $GAS_URL = config('services.shopee_script_url');

            if (!$GAS_URL) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'ไม่พบโครงสร้างบริการ GAS ในระบบ Config'
                ], 500);
            }

            // 2. จัดโครงสร้าง Payload ให้ตรงตามที่ GAS คาดหวัง
            // GAS แกะ payload และดึง data.order_sn หรือ data.tracking_number
            $payload = [
                'action' => 'setpacked',
                'order_sn' => $req->order_sn,
            ];

            try {
                // 3. ยิง HTTP POST ไปที่ Google Apps Script
                $response = Http::timeout(15)->post($GAS_URL, $payload);

                if ($response->failed()) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Google Apps Script ไม่ตอบกลับหรือเกิดข้อผิดพลาดทางเครือข่าย'
                    ], 502);
                }

                // แกะ JSON ที่ GAS ส่งกลับมา (ที่ระบุ status: success / error)
                $gasResult = $response->json();

                // 4. ส่งผลลัพธ์กลับไปให้ฝั่ง React จัดการต่อ
                if (isset($gasResult['status']) && $gasResult['status'] === 'success') {
                    return response()->json([
                        'status' => 'success',
                        'message' => $gasResult['message'] ?? 'อัปเดตสถานะแพ็คสินค้าเรียบร้อย'
                    ], 200);
                }

                return response()->json([
                    'status' => 'error',
                    'message' => $gasResult['message'] ?? 'GAS ปฏิเสธการอัปเดตข้อมูล'
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
