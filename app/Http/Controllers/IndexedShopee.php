<?php

namespace App\Http\Controllers;

use App\Models\Order; // 👈 เพิ่มการ import Model Order
use App\Models\OrderItem;
use App\Models\SystemSetting;
use App\Models\Variant;
use App\Normalizers\GasProductNormalizer;
use App\Services\ProductEnrichmentService;
use App\Services\RequiredProductEnrichmentService;
use App\Services\VersionCheckerService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
        $GAS = config('services.shopee_script_url');
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

                if (! $localData) {
                    Artisan::call('db:seed', [
                        '--class' => 'OrderSeeder',
                        '--force' => true,
                    ]);
                    $localData = $this->sqlite_queryUnpackedInternal($searchId);

                    // ถ้ายังไม่เจออีก ก็แปลว่าไม่มีจริงๆ จบข่าว
                    if (! $localData) {
                        return response()->json([
                            'success' => false,
                            'status' => 'shopee-sqlite-changed',
                            'message' => 'ดึงข้อมูลใหม่แล้ว แต่ก็ยังไม่พบออเดอร์ในระบบ',
                        ], 404);
                    }
                }

                $resData = json_decode(json_encode($localData));

            } catch (\Throwable $e) {
                Log::error('❌ SQLite Mode Error: '.$e->getMessage());

                return response()->json([
                    'message' => 'ไม่สามารถตรวจสอบความถูกต้องของข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                    'detail' => $e->getMessage(),
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

                if (! $response || $response->failed()) {
                    $body = $response ? ($response->json() ?? $response->body()) : 'No response';

                    return response()->json([
                        'message' => 'เชื่อมต่อข้อมูลไม่สำเร็จ',
                        'detail' => [
                            'status' => $response ? $response->status() : 502,
                            'error' => $body,
                        ],
                    ], 502, [], JSON_UNESCAPED_UNICODE);
                }

                $resData = $response->object();

            } catch (\Throwable $e) {
                Log::error('❌ Request Error in pool processing: '.$e->getMessage());

                return response()->json([
                    'message' => 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย',
                    'detail' => $e->getMessage(),
                ], 500);
            }
        }

        // ── 2. Parse Data และทำงานต่อ (แชร์ Logic ร่วมกันได้แล้วเพราะโครงสร้างเหมือนกัน) ───────────────────
        if (! $resData || ! isset($resData->success)) {
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
        if (! $gasData) {
            return response()->json(['message' => 'ระบบตอบ success แต่ไม่มี data'], 502);
        }

        $products = GasProductNormalizer::normalize(
            (array) ($gasData->product_info_sku ?? [])
        );

        $skus = array_map(fn ($p) => $p->sku, $products);

        return response()->json([
            'tracking_number' => $gasData->tracking_number ?? null,
            'order_sn' => $gasData->order_sn ?? null,
            'products' => $this->enricher->enrich($products),
            'is_packed' => $gasData->IsPacked ?? 0,
            'db_auto_synced' => $versionMismatchDetected,
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

        if (! $order) {
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
                'YearMonth' => $order->timestamp ? Carbon::parse($order->timestamp)->format('Y-m') : null,
            ],
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // ส่วนดั้งเดิมสำหรับเรียกใช้งานทางตรงผ่าน Route API (หากยังมีความจำเป็นต้องใช้)
    // ─────────────────────────────────────────────────────────────────
    public function sqlite_queryUnpacked(Request $req): JsonResponse
    {
        $req->validate([
            'tracking_number' => 'nullable|string',
            'order_sn' => 'nullable|string',
        ]);

        $searchId = $req->tracking_number ?? $req->order_sn;

        if (! $searchId) {
            return response()->json([
                'status' => 'error',
                'message' => 'โปรดระบุ tracking_number หรือ order_sn อย่างใดอย่างหนึ่ง',
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

        if (! $GAS_URL) {
            return response()->json([
                'status' => 'error',
                'message' => 'ไม่พบโครงสร้างบริการ GAS ในระบบ Config',
            ], 500);
        }

        $shortages = $this->checkStockAvailability($req->tracking_number);

        if (! empty($shortages)) {
            return response()->json([
                'status' => 'warning',
                'message' => 'สต็อกไม่พอสำหรับสินค้า: '.implode(', ', array_map(
                    fn ($s) => "{$s['sku']} (ต้องการ {$s['required']} มี {$s['available']})",
                    $shortages
                )),
                'data' => ['shortages' => $shortages],
            ], 400);
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
                    'message' => 'Google Apps Script ไม่ตอบกลับหรือเกิดข้อผิดพลาดทางเครือข่าย',
                ], 502);
            }

            $gasResult = $response->json();

            if (isset($gasResult['already_packed']) && $gasResult['already_packed'] === true) {
                return response()->json([
                    'status' => 'warning',
                    'message' => 'สินค้าชิ้นนี้ถูกแพ็คแล้ว',
                    'data' => [
                        'tracking_number' => $gasResult['tracking_number'] ?? $req->tracking_number,
                        'packed_at' => $gasResult['packed_at'] ?? now()->toIso8601String(),
                    ],
                ], 400);
            }

            if (isset($gasResult['success']) && $gasResult['success'] === true) {
                Order::where('tracking_number', $req->tracking_number)->update(['is_packed' => true]);
                $this->decrementStockForOrder($req->tracking_number);

                return response()->json([
                    'status' => 'success',
                    'message' => $gasResult['message'] ?? 'อัปเดตสถานะแพ็คสินค้าเรียบร้อย',
                    'data' => [
                        'tracking_number' => $gasResult['tracking_number'] ?? $req->tracking_number,
                        'packed_at' => $gasResult['packed_at'] ?? now()->toIso8601String(),
                    ],
                ], 200);
            }

            return response()->json([
                'status' => 'error',
                'message' => $gasResult['error'] ?? 'GAS ปฏิเสธการอัปเดตข้อมูล',
            ], 400);

        } catch (\Exception $e) {
            Log::error('GAS Packing Update Error: '.$e->getMessage());

            return response()->json([
                'status' => 'error',
                'message' => 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * แปลง OrderItem แต่ละแถวเป็นรายการ barcode/quantity ที่ต้องใช้จริง โดยขยาย
     * bundle SKU (origin_sku / dummy_item, ดู Variant::bundle) ออกเป็น component barcode
     * ของมันเอง แทนที่จะมองว่า OrderItem.sku = barcode เดียวเสมอ
     *
     * @param  Collection<int, OrderItem>  $items
     * @return array{needed: array<string, int>, untracked: array<int, array{label: string, quantity: int}>, lines: array<int, array{label: string, barcode: ?string, quantity: int}>}
     */
    private function resolveOrderBarcodeQuantities(Collection $items): array
    {
        $variantsBySku = Variant::whereIn('sku', $items->pluck('sku'))->get()->keyBy('sku');

        $bundleSkus = [];
        foreach ($items as $item) {
            $bundleJson = $variantsBySku->get($item->sku)?->bundle;
            $bundleData = $bundleJson ? json_decode($bundleJson) : null;

            if (is_array($bundleData)) {
                foreach ($bundleData as $entry) {
                    if (($entry->type ?? null) === 'origin_sku' && ! empty($entry->sku)) {
                        $bundleSkus[] = $entry->sku;
                    }
                }
            }
        }

        if (! empty($bundleSkus)) {
            $variantsBySku = $variantsBySku->union(
                Variant::whereIn('sku', array_unique($bundleSkus))->get()->keyBy('sku')
            );
        }

        $lines = [];

        foreach ($items as $item) {
            $variant = $variantsBySku->get($item->sku);
            $bundleData = $variant?->bundle ? json_decode($variant->bundle) : null;

            if (is_array($bundleData)) {
                foreach ($bundleData as $index => $entry) {
                    $entryQuantity = $item->quantity * ($entry->quantity ?? 0);

                    if (($entry->type ?? null) === 'origin_sku' && ! empty($entry->sku)) {
                        $lines[] = [
                            'label' => $entry->sku,
                            'barcode' => $variantsBySku->get($entry->sku)?->barcode,
                            'quantity' => $entryQuantity,
                        ];
                    } elseif (($entry->type ?? null) === 'dummy_item') {
                        $label = $item->sku.'_'.$index.'_'.($entry->display_variant ?? 'dummy');
                        $lines[] = [
                            'label' => $label,
                            'barcode' => $entry->barcode ?? null,
                            'quantity' => $entryQuantity,
                        ];
                    } else {
                        // unknown type, or origin_sku missing its sku — unresolvable, must not be silently dropped
                        $label = $item->sku.'_'.$index.'_'.($entry->type ?? 'unknown');
                        $lines[] = [
                            'label' => $label,
                            'barcode' => null,
                            'quantity' => $entryQuantity,
                        ];
                    }
                }
            } else {
                $lines[] = [
                    'label' => $item->sku,
                    'barcode' => $variant?->barcode,
                    'quantity' => $item->quantity,
                ];
            }
        }

        $needed = [];
        $untracked = [];

        foreach ($lines as $line) {
            if (! $line['barcode']) {
                $untracked[] = ['label' => $line['label'], 'quantity' => $line['quantity']];

                continue;
            }

            $needed[$line['barcode']] = ($needed[$line['barcode']] ?? 0) + $line['quantity'];
        }

        return ['needed' => $needed, 'untracked' => $untracked, 'lines' => $lines];
    }

    /**
     * เช็กว่าสต็อกพอสำหรับออเดอร์นี้หรือไม่ ก่อนอนุญาตให้แพ็ค
     * ทำงานแบบ fail-open: ถ้าเรียก GAS สต็อกไม่ได้ จะถือว่าผ่าน (log ไว้) ไม่บล็อกการแพ็ค
     * แต่ SKU ที่ไม่มี barcode ให้ track เลยจะถือว่าบล็อกเสมอ
     *
     * @return array<int, array{sku: string, barcode: ?string, required: int, available: int}>
     */
    private function checkStockAvailability(string $trackingNumber): array
    {
        $stockGasUrl = config('services.stock_script_url');

        if (! $stockGasUrl) {
            return [];
        }

        $order = Order::where('tracking_number', $trackingNumber)->with('items')->first();

        if (! $order || $order->items->isEmpty()) {
            return [];
        }

        $resolved = $this->resolveOrderBarcodeQuantities($order->items);

        $shortages = [];

        foreach ($resolved['untracked'] as $untrackedLine) {
            $shortages[] = ['sku' => $untrackedLine['label'], 'barcode' => null, 'required' => $untrackedLine['quantity'], 'available' => 0];
        }

        if (empty($resolved['needed'])) {
            return $shortages;
        }

        try {
            $response = Http::timeout(15)->get($stockGasUrl, ['action' => 'get-stocks']);

            if ($response->failed()) {
                Log::error("❌ Stock Check GAS Error (tracking: {$trackingNumber}): request failed, allowing pack (fail-open)");

                return [];
            }
        } catch (\Throwable $e) {
            Log::error("❌ Stock Check GAS Error (tracking: {$trackingNumber}): ".$e->getMessage().' — allowing pack (fail-open)');

            return [];
        }

        $countByBarcode = collect($response->json('data') ?? [])->pluck('count', 'barcode');

        foreach ($resolved['needed'] as $barcode => $requiredQuantity) {
            $barcode = (string) $barcode;

            if (! $countByBarcode->has($barcode)) {
                $shortages[] = ['sku' => $barcode, 'barcode' => $barcode, 'required' => $requiredQuantity, 'available' => 0];

                continue;
            }

            $available = (int) $countByBarcode[$barcode];

            if ($available < $requiredQuantity) {
                $shortages[] = ['sku' => $barcode, 'barcode' => $barcode, 'required' => $requiredQuantity, 'available' => $available];
            }
        }

        return $shortages;
    }

    /**
     * ตัดสต็อกตาม barcode ของแต่ละ SKU (รวมถึง component ของ bundle) ในออเดอร์ที่เพิ่งแพ็คสำเร็จ
     * ทำงานแบบ best-effort: ถ้าตัดสต็อกไม่สำเร็จจะแค่ log ไว้ ไม่ทำให้ response การแพ็ค fail
     */
    private function decrementStockForOrder(string $trackingNumber): void
    {
        $stockGasUrl = config('services.stock_script_url');

        if (! $stockGasUrl) {
            return;
        }

        try {
            $order = Order::where('tracking_number', $trackingNumber)->with('items')->first();

            if (! $order) {
                return;
            }

            $resolved = $this->resolveOrderBarcodeQuantities($order->items);

            foreach ($resolved['untracked'] as $untrackedLine) {
                Log::warning("⚠️ ไม่พบ barcode สำหรับ {$untrackedLine['label']} สำหรับตัดสต็อก (tracking: {$trackingNumber})");
            }

            foreach ($resolved['needed'] as $barcode => $quantity) {
                Http::timeout(15)->post($stockGasUrl, [
                    'action' => 'decrement-stock',
                    'barcode' => (string) $barcode,
                    'quantity' => $quantity,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("❌ Stock Decrement Error (tracking: {$trackingNumber}): ".$e->getMessage());
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
                        Log::info('✅ Auto-sync completed.');
                    } catch (\Exception $e) {
                        Log::error('❌ Auto-sync failed: '.$e->getMessage());
                    }
                }
            } else {
                SystemSetting::create(['key' => self::GAS_VERSION_KEY, 'value' => $currentGasVersion]);
            }
        } else {
            Log::error('❌ Cannot fetch version from GAS API.');
        }
    }

    public function getRequiredProducts(Request $req)
    {
        $versionMismatchDetected = false;
        $gasUrl = config('services.shopee_script_url');
        $ProductLineGAS = config('services.products_script_url');

        $parameter = [
            'action' => 'query_sku_summary',
        ];

        $ShopeeOrderReq = Http::async()->post($gasUrl, $parameter);
        $ProductLineVersionChecker = Http::get($ProductLineGAS, ['action' => 'version']);
        if ($ProductLineVersionChecker) {
            $this->handleVersionCheck($ProductLineVersionChecker, $versionMismatchDetected);
        }

        $waitShopee = $ShopeeOrderReq->wait();

        if ($waitShopee->successful()) {
            $response = json_decode($waitShopee);

            // return $response->summary;

            $normalize = GasProductNormalizer::requiredProducts_normalize(
                (array) ($response->summary ?? [])
            );

            return $this->requiredEnricher->enrich($normalize);
        }

        return response()->json(['error' => 'GAS Error'], 502);
    }
}
