<?php

namespace App\Repositories;

use App\DTOs\OrderFetchResult;
use App\Exceptions\OrderFetchException;
use App\Services\VersionCheckerService;
use App\Http\Controllers\IndexedShopee;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SqliteOrderRepository implements OrderRepositoryInterface
{
    public function __construct(
        private VersionCheckerService $versionChecker,
        private IndexedShopee $sqliteService, // ชั่วคราว
    ) {}

    public function fetchOrder(string $searchId, array $searchParameter): OrderFetchResult
    {
        $GASvproductLine = config('services.products_script_url');

        try {
            $poolResults = Http::pool(fn($pool) => [
                $pool->as('versionChecker')->get($GASvproductLine, ['action' => 'version']),
            ]);

            // เรียก service แทน — return bool ตรงๆ ไม่ mutate อะไร
            $mismatch = $this->versionChecker->check($poolResults['versionChecker'] ?? null);

            $localJsonRes = $this->sqliteService->sqlite_queryUnpackedInternal($searchId);

            if ($localJsonRes->getStatusCode() !== 200) {
                throw new OrderFetchException(
                    json_decode($localJsonRes->getContent())->message ?? 'ไม่พบข้อมูล',
                    $localJsonRes->getStatusCode()
                );
            }

            return new OrderFetchResult(
                data: json_decode($localJsonRes->getContent()),
                versionMismatchDetected: $mismatch,
            );

        } catch (OrderFetchException $e) {
            throw $e; //던ต่อขึ้นไปให้ Controller จัดการ
        } catch (\Throwable $e) {
            Log::error("❌ SQLite Mode Error: " . $e->getMessage());
            throw new OrderFetchException('ไม่สามารถตรวจสอบความถูกต้องของข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 503);
        }
    }
}
