<?php

namespace App\Http\Controllers;

use App\Models\Order; // 👈 เพิ่มการ import Model Order
use App\Models\SystemSetting;
use App\Models\Variant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Normalizers\GasProductNormalizer;
use App\Services\ProductEnrichmentService;
use App\Services\RequiredProductEnrichmentService;
use App\Services\VersionCheckerService;


class IndexedShopee extends Controller
{
    public function __construct(
        private readonly ProductEnrichmentService $enricher,
        private readonly RequiredProductEnrichmentService $requiredEnricher,
        private readonly VersionCheckerService $versionChecker,
    ) {}

    private const onquery_mode = 'sqlite';
    private const GAS_VERSION_KEY = 'shopee_gas_version';

    public function queryShopeeData(Request $req)
    {
        $req->validate(['q' => 'required|string']);

        $searchId = trim($req->q);
        $GAS      = config('services.shopee_script_url');
        $GASvproductLine = config('services.products_script_url');

        $searchKey = str_starts_with(strtoupper($searchId), 'TH') ? 'tracking_number' : 'order_sn';
        $searchParameter = [
            'action' => 'query_single',
            $searchKey => $searchId,
        ];

        $versionMismatchDetected = false;
        $resData = null;

        // ── 1. Transport Handling (แยกขาดระหว่าง SQLite และ API) ───────────────────
        if (self::onquery_mode === 'sqlite') {
            try {
                // เช็คเวอร์ชันผ่าน Pool Async ทิ้งไว้
                $poolResults = Http::pool(fn ($pool) => [
                    $pool->as('versionChecker')->get($GASvproductLine, ['action' => 'version']),
                ]);

                $versionResponse = $poolResults['versionChecker'] ?? null;
                if ($versionResponse) {
                    $this->handleVersionCheck($versionResponse, $versionMismatchDetected);
                }

                // ดึงข้อมูลจาก Local SQLite ตรงๆ
                $localData = $this->sqlite_queryUnpackedInternal($searchId);

                if (!$localData) {
                    Artisan::call('db:seed', [
                        '--class' => 'OrderSeeder',
                        '--force' => true,
                    ]);
                    $localData = $this->sqlite_queryUnpackedInternal($searchId);

                    // ถ้ายังไม่เจออีก ก็แปลว่าไม่มีจริงๆ จบข่าว
                    if (!$localData) {
                        return response()->json([
                            'success' => false,
                            'status' => 'shopee-sqlite-changed',
                            'message' => 'ดึงข้อมูลใหม่แล้ว แต่ก็ยังไม่พบออเดอร์ในระบบ',
                        ], 404);
                    }
                }

                $resData = json_decode(json_encode($localData));

            } catch (\Throwable $e) {
                Log::error("❌ SQLite Mode Error: " . $e->getMessage());
                return response()->json([
                    'message' => 'ไม่สามารถตรวจสอบความถูกต้องของข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                    'detail'  => $e->getMessage(),
                ], 503);
            }
        } else {
            // โหมดปกติ: ยิงคู่ขนาน Async ไปที่ GAS API ผ่าน Laravel Http Pool (ปลอดภัยกว่าพิมพ์ Guzzle เอง)
            try {
                $responses = Http::pool(fn ($pool) => [
                    $pool->as('orderSearch')->post($GAS, $searchParameter),
                    $pool->as('versionChecker')->get($GASvproductLine, ['action' => 'version']),
                ]);

                $response = $responses['orderSearch'] ?? null;
                $versionResponse = $responses['versionChecker'] ?? null;

                if ($versionResponse) {
                    $this->handleVersionCheck($versionResponse, $versionMismatchDetected);
                }

                if (!$response || $response->failed()) {
                    $body = $response ? ($response->json() ?? $response->body()) : 'No response';
                    return response()->json([
                        'message' => 'เชื่อมต่อข้อมูลไม่สำเร็จ',
                        'detail'  => [
                            'status' => $response ? $response->status() : 502,
                            'error'  => $body
                        ],
                    ], 502, [], JSON_UNESCAPED_UNICODE);
                }

                $resData = $response->object();

            } catch (\Throwable $e) {
                Log::error("❌ Request Error in pool processing: " . $e->getMessage());
                return response()->json([
                    'message' => 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย',
                    'detail'  => $e->getMessage(),
                ], 500);
            }
        }

        // ── 2. Parse Data และทำงานต่อ (แชร์ Logic ร่วมกันได้แล้วเพราะโครงสร้างเหมือนกัน) ───────────────────
        if (!$resData || !isset($resData->success)) {
            return response()->json([
                'message' => 'ระบบคืนข้อมูลที่อ่านไม่ได้',
            ], 502);
        }

        if ($resData->success !== true) {
            return response()->json([
                'message' => $resData->error ?? $resData->message ?? 'ระบบปฏิเสธ request โดยไม่บอกเหตุผล',
            ], 400);
        }

        $gasData = $resData->data ?? null;
        if (!$gasData) {
            return response()->json(['message' => 'ระบบตอบ success แต่ไม่มี data'], 502);
        }

        $products = GasProductNormalizer::normalize(
            (array) ($gasData->product_info_sku ?? [])
        );

        $skus = array_map(fn($p) => $p->sku, $products);

        return response()->json([
            'tracking_number' => $gasData->tracking_number ?? null,
            'order_sn'        => $gasData->order_sn        ?? null,
            'products'        => $this->enricher->enrich($products),
            'is_packed'       => $gasData->IsPacked        ?? 0,
            'db_auto_synced'  => $versionMismatchDetected,
        ]);
    }

    /**
     * ฟังก์ชันภายในเพื่อดึงข้อมูลจาก SQLite และทำการจำลอง (Mock) ให้อยู่ในรูปโครงสร้าง Client Response Object
     */
    private function sqlite_queryUnpackedInternal(string $searchId): ?array
    {
        $order = Order::with('items')
            ->PendingPack()
            ->where(function ($q) use ($searchId) {
                $q->where('tracking_number', $searchId)
                  ->orWhere('order_sn', $searchId);
            })
            ->first();

        if (!$order) {
            // return response()->json([
            //     'success' => false,
            //     'message' => 'ไม่พบข้อมูลออเดอร์ในระบบฐานข้อมูล SQLite Local'
            // ], 404);
            return null;
        }

        return [
            'success' => true,
            'data' => [
                'tracking_number' => $order->tracking_number,
                'order_sn' => $order->order_sn,
                'product_info_sku' => $order->items->map(function ($item) {
                    return [
                        'sku' => $item->sku,
                        'quantity' => $item->quantity,
                        'price' => $item->price,
                    ];
                })->values()->all(),
                'TimeStamp' => $order->timestamp,
                'IsPacked' => $order->is_packed ? 1 : 0,
                'PackedAt' => $order->packed_at,
                'IsActive' => $order->is_active ? 1 : 0,
                'YearMonth' => $order->timestamp ? \Carbon\Carbon::parse($order->timestamp)->format('Y-m') : null,
            ]
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // ส่วนดั้งเดิมสำหรับเรียกใช้งานทางตรงผ่าน Route API (หากยังมีความจำเป็นต้องใช้)
    // ─────────────────────────────────────────────────────────────────
    public function sqlite_queryUnpacked(Request $req) : JsonResponse
    {
        $req->validate([
            'tracking_number' => 'nullable|string',
            'order_sn' => 'nullable|string'
        ]);

        $searchId = $req->tracking_number ?? $req->order_sn;

        if (!$searchId) {
            return response()->json([
                'status' => 'error',
                'message' => 'โปรดระบุ tracking_number หรือ order_sn อย่างใดอย่างหนึ่ง'
            ], 400);
        }

        $response = $this->sqlite_queryUnpackedInternal($searchId);
        return response()->json($response, 200);
    }

    public function setpacked(Request $req)
    {
        $req->validate([
            'tracking_number' => 'required|string',
            'order_sn' => 'nullable|string',
        ]);

        $GAS_URL = config('services.shopee_script_url');

        if (!$GAS_URL) {
            return response()->json([
                'status' => 'error',
                'message' => 'ไม่พบโครงสร้างบริการ GAS ในระบบ Config'
            ], 500);
        }

        $payload = [
            'action' => 'pack',
            'tracking_number' => $req->tracking_number,
        ];

        try {
            $response = Http::timeout(15)->post($GAS_URL, $payload);

            if ($response->failed()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Google Apps Script ไม่ตอบกลับหรือเกิดข้อผิดพลาดทางเครือข่าย'
                ], 502);
            }

            $gasResult = $response->json();

            if (isset($gasResult['already_packed']) && $gasResult['already_packed'] === true) {
                return response()->json([
                    'status' => 'warning',
                    'message' => 'สินค้าชิ้นนี้ถูกแพ็คแล้ว',
                    'data' => [
                        'tracking_number' => $gasResult['tracking_number'] ?? $req->tracking_number,
                        'packed_at' => $gasResult['packed_at'] ?? now()->toIso8601String()
                    ]
                ], 400);
            }

            if (isset($gasResult['success']) && $gasResult['success'] === true) {
                    Order::where('tracking_number', $req->tracking_number)->update(['is_packed' => true]);                return response()->json([
                    'status' => 'success',
                    'message' => $gasResult['message'] ?? 'อัปเดตสถานะแพ็คสินค้าเรียบร้อย',
                    'data' => [
                        'tracking_number' => $gasResult['tracking_number'] ?? $req->tracking_number,
                        'packed_at' => $gasResult['packed_at'] ?? now()->toIso8601String()
                    ]
                ], 200);
            }

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

    public function queryByDate(Request $req)
    {
        $GAS_URL = config('services.shopee_script_url');
        $parameter = [
            'date' => '2026-06-17',
            'action' => 'query_daily',
            'tracking_number' => '260505K3D4J54K',
        ];

        $response = Http::timeout(15)->post($GAS_URL, $parameter);
        return $response->json();
    }

    private function handleVersionCheck($versionResponse, &$versionMismatchDetected)
    {
        if ($versionResponse->successful()) {
            $currentGasVersion = trim($versionResponse->body());
            $versionSetting = SystemSetting::where('key', self::GAS_VERSION_KEY)->first();

            if ($versionSetting) {
                if ($versionSetting->value !== $currentGasVersion) {
                    Log::info("🚨 Version Changed! Local: [{$versionSetting->value}] → GAS: [{$currentGasVersion}]");
                    $versionMismatchDetected = true;

                    try {
                        Artisan::call('db:seed', [
                            '--class' => 'ProductSeeder',
                            '--force' => true,
                        ]);
                        Log::info("✅ Auto-sync completed.");
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
    }

    public function getRequiredProducts(Request $req){
        $versionMismatchDetected = false;
        $ProductLineGAS = config('services.products_script_url');
        $ProductLineVersionChecker = Http::get($ProductLineGAS, ['action' => 'version']);
        if ($ProductLineVersionChecker){
            $this->handleVersionCheck($ProductLineVersionChecker, $versionMismatchDetected);
        }
            $parameter = [
                'action' => 'query_sku_summary',
            ];
            $gasUrl = config('services.shopee_script_url');
            $response = json_decode(Http::post($gasUrl, $parameter));

            // return $response->summary;

            $normalize = GasProductNormalizer::requiredProducts_normalize(
                (array) ($response->summary ?? [])
            );

            return $this->requiredEnricher->enrich($normalize);
    }
}
