<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http; // <-- ขาดตัวนี้!

class SummaryController extends Controller
{
    public function getDailySummary(){
        $tiktokshopRes = Http::post('https://script.google.com/macros/s/AKfycbyi-Pz8el_aChRSp8bqxubT-8tXsEiTsk4P_ZF88r26mSPAnIO2vtvRTcOLGXgUzcxO/exec');
        $shopeeRes = Http::post('https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec', ['action' => 'total']);

        $result = [
            'TiktokShop' => $tiktokshopRes->json(),
            'Shopee' => $shopeeRes->json(),
        ];

        // แปลง Response ของ Google เป็น JSON Array แบบสวยๆ ให้ React เอาไปใช้ง่าย
        return response()->json($result);
    }
}
