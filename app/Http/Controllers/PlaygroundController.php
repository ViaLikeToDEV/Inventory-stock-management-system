<?php

declare(strict_types=1);

namespace App\Http\Controllers;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\Product;
use App\Models\Variant;
use App\Models\OrderItem;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use App\DTOs\RawProductData;

class PlaygroundController extends Controller
{
    private string $googleAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzmtPYi0Ps81ddEeg9bEzl9clO6ZFs5dmV5RNh2KWkCkQYO6c3G8bbzKUcwB9iGyHyk5A/exec';


    public function page(){
        return inertia::render('pg/pg');
    }


    public function SendThemAndSendBack(){
        $someobj = [
            "message" => "hello world",
            "action" => "sendmeback",
            "nested1" => [
                "item1" => "this is text from item1",
                "item2" => "this is text from item2",
            ],
            "nested2" => ['item1','item2','item3']
        ];

        $res = $res = Http::asJson()->post('https://script.google.com/macros/s/AKfycbxhnDLikh_kWZzUfDWSiApDBlww5wbyNj-SYM8r0q9SzvUEDnc7qtpGD-pETCok37kOKg/exec', $someobj);

        return $res;
    }

    public function bundlescript(){
        $searchParameter = [
            'action' => 'productsinfolists'
        ];

        $GAS = config('services.products_script_url');

        $response = Http::timeout(15)->post($GAS, $searchParameter);
        $data = $response->object();
    }

    public function pgfunc(): JsonResponse
    {
    // {
    //     $searchId = '260505K590GUJ1';
    //     {
    //     $order = Order::with('items')
    //     ->PendingPack()
    //     ->where(function ($q) use ($searchId) {
    //         $q->where('tracking_number', $searchId)
    //         ->orWhere('order_sn', $searchId);
    //     })
    //     ->first();

    //     if (!$order) {
    //         return response()->json([
    //             'success' => false,
    //             'error' => 'ไม่พบข้อมูลออเดอร์ในระบบฐานข้อมูล SQLite Local'
    //         ], 404);
    //     }

    //     $mockData = [
    //         'success' => true,
    //         'data' => [
    //             'tracking_number' => $order->tracking_number,
    //             'order_sn' => $order->order_sn,
    //             'product_info_sku' => $order->items->map(function ($item) {
    //                 return [
    //                     'sku' => $item->sku,
    //                     'quantity' => $item->quantity,
    //                     'price' => $item->price,
    //                 ];
    //             })->values()->all(),
    //             'TimeStamp' => $order->timestamp,
    //             'IsPacked' => $order->is_packed ? 1 : 0,
    //             'PackedAt' => $order->packed_at,
    //             'IsActive' => $order->is_active ? 1 : 0,
    //             'YearMonth' => $order->timestamp ? \Carbon\Carbon::parse($order->timestamp)->format('Y-m') : null,
    //         ]
    //     ];

    //     // 3. 👈 คืนค่าเป็น Response Object ประกอบร่างจาก Guzzle PSR-7
    //     return response()->json($mockData);
    // }
    $a = "5 monkeys";
    return var_dump(0 == null);
    }


    public function queryTrackings()
    {
        // ─── CONFIGURATION (แก้ไขตรงนี้ได้เลย) ───────────────────────

        // URL ของ Google Apps Script Web App ที่ได้จากการ Deploy (เปลี่ยนเป็นของคุณ)
        $webAppUrl = $this->googleAppsScriptUrl;

        // พารามิเตอร์ที่ต้องการ Hardcode ส่งไปยัง handleQuery
        $payload = [
            'action'    => 'query',
            'yearMonth' => '2026-05' // รูปแบบ YYYY-MM ตามที่ GAS Validate ไว้
        ];

        // ─── EXECUTION ──────────────────────────────────────────────
        try {
            // Google Apps Script มีการทำ Redirect (302) เป็นปกติ
            // Http facade ของ Laravel จะตามดักให้อัตโนมัติ (withRedirects() เป็น default)
            $response = Http::timeout(15) // ตั้ง timeout เผื่อกรณีแผ่นงานคิวรี่นาน
                            ->post($webAppUrl, $payload);

            if ($response->failed()) {
                return response()->json([
                    'success' => false,
                    'error'   => 'Failed to connect to Google Apps Script',
                    'status'  => $response->status()
                ], $response->status());
            }

            // รับผลลัพธ์ JSON กลับมาจาก GAS
            $result = $response->json();

            // ตรวจสอบ success flag ภายใน JSON ที่ส่งมาจาก GAS
            if (isset($result['success']) && !$result['success']) {
                return response()->json([
                    'success' => false,
                    'error'   => $result['error'] ?? 'Unknown error from GAS'
                ], 400);
            }

            // ส่งข้อมูลกลับไปให้ Frontend หรือ API client ตัวอื่น
            return response()->json([
                'success' => true,
                'source'  => 'GoogleAppsScript_ShopeeDB',
                'meta'    => [
                    'yearMonth' => $result['yearMonth'] ?? $payload['yearMonth'],
                    'count'     => $result['count'] ?? 0
                ],
                'data'    => $result['data'] ?? []
            ]);

        } catch (\Exception $e) {
            // ดักจับ Error เผื่อ Network พัง หรือ URL ผิดพลาด
            Log::error('ShopeeSheetController Error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'error'   => 'Internal Server Error: ' . $e->getMessage()
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    private function error(string $message, int $status = 400): JsonResponse
    {
        return response()->json(['success' => false, 'error' => $message], $status);
    }


    public function querySingle(Request $req)
    {
        $req->validate([
            'q' => 'required|string'
        ]);
        // ===== Hardcoded Config =====
        $trackingNumber = $req->q;
        // ============================

        $payload = [
            'action' => 'query_single',
            'tracking_number' => $trackingNumber,
        ];

        $response = Http::timeout(30)
            ->acceptJson()
            ->post($this->googleAppsScriptUrl, $payload);

        if (!$response->successful()) {
            return response()->json([
                'success' => false,
                'error'   => 'Failed to connect to Google Apps Script',
                'status'  => $response->status(),
            ], 500);
        }

        return response()->json($response->json());
    }

    public function getDailySummary()
    {
        // ════════════════════════════════════════════════
        // 🛑 HARDCODED VARIABLES (แก้ตรงนี้ได้เลยตาม Requirement)
        // ════════════════════════════════════════════════
        $gasUrl = $this->googleAppsScriptUrl;

        // รูปแบบต้องเป็น YYYY-MM-DD ตามที่ GAS ฝั่งนู้นดักไว้ด้วย Regex
        $targetDate = '2026-05-08';
        // ════════════════════════════════════════════════

        // ยิง POST Request ไปที่ Google Apps Script
        $response = Http::post($gasUrl, [
            'action' => 'query_daily_summary',
            'date'   => $targetDate,
        ]);

        if ($response->successful()) {
            $data = $response->json();

            // 🚨 ดักเคสที่ GAS ไม่ได้ส่ง JSON กลับมา (มันจะกลายเป็น null)
            if (is_null($data)) {
                return response()->json([
                    'status'   => 'error',
                    'message'  => 'ชิบหายละ GAS ไม่ได้ส่ง JSON กลับมา! ลองดู Raw Body ซิว่ามันด่าอะไร',
                    'raw_body' => $response->body() // ลากสิ่งที่ Google พ่นออกมาให้ดูเต็มๆ
                ], 400);
            }

            // เช็กต่อว่า Logic ฝั่ง GAS return success: true หรือเปล่า
            if (isset($data['success']) && $data['success'] === true) {
                return response()->json([
                    'status'  => 'success',
                    'message' => 'ดึงข้อมูลสำเร็จ',
                    'data'    => $data
                ]);
            }

            return response()->json([
                'status'  => 'error',
                'message' => $data['error'] ?? 'GAS ส่งคืน success: false แต่ไม่มี error message'
            ], 400);
        }

        // กรณีเน็ตหลุด, URL ผิด หรือ GAS พัง
        return response()->json([
            'status'  => 'error',
            'message' => 'ไม่สามารถเชื่อมต่อกับ Google Apps Script ได้',
            'details' => $response->body()
        ], $response->status());
    }

    public function pack(Request $req) {
        $req->validate([
            'q' => 'required|string'
        ]);

        $payload = [
            'action' => 'pack',
            'tracking_number' => $req->q,
        ];

        $response = Http::timeout(15)->post($this->googleAppsScriptUrl, $payload);

        if ($response->failed()) {
            return response()->json([
                'success' => false,
                'error'   => 'Upstream request failed',
                'status'  => $response->status(),
            ], 502);
        }

        return response()->json($response->json());
    }


}
