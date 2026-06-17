<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ProductAdminController extends Controller
{
    public function fetchProducts()
    {
        // 🚨 เอา URL ของ Google Apps Script ที่เสี่ยเพิ่งกด Deploy มาใส่ในช่องนี้!
        $gasUrl = 'https://script.google.com/macros/s/AKfycbxhnDLikh_kWZzUfDWSiApDBlww5wbyNj-SYM8r0q9SzvUEDnc7qtpGD-pETCok37kOKg/exec';

        try {
            // ยิง POST ไปที่ GAS พร้อมแนบ action ที่เราเพิ่งเขียนไป
            $response = Http::timeout(20)->post($gasUrl, [
                'action' => 'get_products_joined'
            ]);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            // รับก้อน JSON จาก GAS แล้วส่งต่อให้ React ทันที
            return response()->json($response->json());

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function editProductFull(Request $request)
    {
        // 🚨 เอา URL ของ GAS ตัวล่าสุดมาใส่ตรงนี้
        $gasUrl = 'https://script.google.com/macros/s/AKfycbxhnDLikh_kWZzUfDWSiApDBlww5wbyNj-SYM8r0q9SzvUEDnc7qtpGD-pETCok37kOKg/exec';

        try {
            // รับข้อมูลทั้งหมดที่ React ส่งมา
            $payload = $request->all();

            // แอบยัด action เข้าไปในก้อนข้อมูล เพื่อให้ GAS รู้ว่าจะให้ทำอะไร
            $payload['action'] = 'edit_product_full';

            // ยิงไปหา GAS
            $response = Http::timeout(30)->post($gasUrl, $payload);

            if ($response->failed()) {
                throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            }

            return response()->json($response->json());

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function addProductFull(Request $request)
    {
        // URL ของ GAS
        $gasUrl = 'https://script.google.com/macros/s/AKfycbxhnDLikh_kWZzUfDWSiApDBlww5wbyNj-SYM8r0q9SzvUEDnc7qtpGD-pETCok37kOKg/exec';

        try {
            $payload = $request->all();
            $payload['action'] = 'add_product_full';

            $response = Http::timeout(30)->post($gasUrl, $payload);

            if ($response->failed()) throw new \Exception('เชื่อมต่อ Google Sheet ไม่สำเร็จ');
            return response()->json($response->json());

        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}
