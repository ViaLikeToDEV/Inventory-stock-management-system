<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SummaryController extends Controller
{
    public function getDailySummary(Request $request)
    {
        $date = $request->input('date') ?: now()->toDateString();

        $responses = Http::pool(fn (Pool $pool) => [
            $pool->as('tiktokshop')->post(config('services.tiktokshop_script_url')),
            $pool->as('shopee')->post('https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec', [
                'action' => 'query_daily_summary',
                'date' => $date,
            ]),
        ]);

        return response()->json([
            'TiktokShop' => $this->poolResultToJson($responses['tiktokshop']),
            'Shopee' => $this->poolResultToJson($responses['shopee']),
        ]);
    }

    private function poolResultToJson(mixed $result): mixed
    {
        if (! $result instanceof Response) {
            return ['status' => 'error', 'message' => $result instanceof \Throwable ? $result->getMessage() : 'Unknown pool error'];
        }

        if ($result->failed()) {
            return ['status' => 'error', 'message' => 'GAS request failed', 'http_status' => $result->status()];
        }

        return $result->json();
    }
}
