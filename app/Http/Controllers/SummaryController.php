<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http; // <-- ขาดตัวนี้!

class SummaryController extends Controller
{
    public function getDailySummary(){
        $sheetResponse = Http::post('https://script.google.com/macros/s/AKfycbyi-Pz8el_aChRSp8bqxubT-8tXsEiTsk4P_ZF88r26mSPAnIO2vtvRTcOLGXgUzcxO/exec');

        // แปลง Response ของ Google เป็น JSON Array แบบสวยๆ ให้ React เอาไปใช้ง่าย
        return response()->json($sheetResponse->json());
    }
}
