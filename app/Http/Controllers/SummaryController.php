<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;

class SummaryController extends Controller
{
    public function getDailySummary()
    {
        $responses = Http::pool(fn (Pool $pool) => [
        $pool->as('tiktokshop')->post(config('services.tiktokshop_script_url')),
        $pool->as('shopee')->post('https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec', ['action' => 'total']),
    ]);

    $result = [
        'TiktokShop' => $responses['tiktokshop']->json(),
        'Shopee'     => $responses['shopee']->json(),
    ];

    return response()->json($result);
        }
}
