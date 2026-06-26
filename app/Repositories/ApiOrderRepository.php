<?php

namespace App\Repositories;

use App\DTOs\OrderFetchResult;
use App\Exceptions\OrderFetchException;
use App\Services\VersionCheckerService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ApiOrderRepository implements OrderRepositoryInterface
{
    public function __construct(
        private VersionCheckerService $versionChecker,
    ) {}

    public function fetchOrder(string $searchId, array $searchParameter): OrderFetchResult
    {
        $GAS             = config('services.shopee_script_url');
        $GASvproductLine = config('services.products_script_url');

        try {
            $responses = Http::pool(fn($pool) => [
                $pool->as('orderSearch')->post($GAS, $searchParameter),
                $pool->as('versionChecker')->get($GASvproductLine, ['action' => 'version']),
            ]);

            $response        = $responses['orderSearch'] ?? null;
            $versionResponse = $responses['versionChecker'] ?? null;

            $mismatch = $this->versionChecker->check($versionResponse);

            if (!$response || $response->failed()) {
                $body = $response ? ($response->json() ?? $response->body()) : 'No response';
                throw new OrderFetchException('เชื่อมต่อข้อมูลไม่สำเร็จ', 502);
            }

            return new OrderFetchResult(
                data: $response->object(),
                versionMismatchDetected: $mismatch,
            );

        } catch (OrderFetchException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error("❌ API Mode Error: " . $e->getMessage());
            throw new OrderFetchException('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย', 500);
        }
    }
}
