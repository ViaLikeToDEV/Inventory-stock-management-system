<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class SkuFetchTestController extends Controller
{
    // หน้าบ้าน Inertia
    public function index()
    {
        return Inertia::render('SkuFetchTest/Index');
    }

    // API รับช่วงต่อเพื่อยิงเข้า Google Apps Script
    public function check(Request $request)
    {
        $request->validate([
            'search_texts' => 'required|array',
            'search_texts.*' => 'string'
        ]);

        $gasUrl = 'https://script.google.com/macros/s/AKfycbxV00UmBwTnzyrT4kamXFloDC2_xllsE6J-SfdbGU-HBMHEhELzc3lt0YzAQEObmFeNBQ/exec';

        // ยิงหลบหลังบ้านเข้าไปหา Google Apps Script
        $response = Http::post($gasUrl, [
            'search_texts' => $request->input('search_texts')
        ]);

        if ($response->failed()) {
            return response()->json(['error' => 'Failed to query Google Sheets'], 500);
        }

        return response()->json($response->json());
    }
}
