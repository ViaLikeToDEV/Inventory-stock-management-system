<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PlaygroundController extends Controller
{
    public function SendThemAndSendBack(){
        $someobj = [
            "message" => "hello world",
            "nested1" => [
                "item1" => "this is text from item1",
                "item2" => "this is text from item2",
            ]
        ];

        $res = Http::post('https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec', $someobj);

        return $res;
    }

    public function queryShopeeData(){
        $searchId = '260505HYJKR5VT';
        $GAS = 'https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec';

        $searchParameter = [
            'action' => 'query',
            'qarguement' => $searchId,
        ];

        $response = Http::timeout(15)->post($GAS, $searchParameter);

        if ($response->failed()) {
            return response()->json(['message' => ' cannot connect to GAS'], 500);
        }

        // 3. แปลงค่าผลลัพธ์เป็น Object ของ PHP
        $resData = $response->object();

        // เช็ค status ที่คุณคัสตอมมาจาก GAS ว่า 'success' หรือเปล่า
        if (isset($resData->status) && $resData->status === 'success') {

            // ดึงอาเรย์ matching ออกมา (จับคู่ตามลำดับ row column ในชีต)
            $matching = $resData->matching;

            $trackingNumber = $matching[0] ?? null;
            $orderSn        = $matching[1] ?? null;
            $products       = $matching[2] ?? [];  // 💡 ตรงนี้จะเป็น Array ของ Object แล้ว!
            $timestamp      = $matching[3] ?? null;
            $isPacked       = $matching[4] ?? 0;

            // 4. เอา $products ไปวนลูปใช้งานต่อได้เลย
            foreach ($products as $product) {
                $sku = $product->sku;
                $quantity = $product->quantity;
                $price = $product->price;

                // จะเอาไปบันทึกลง DB ตัวเอง หรือจะเอาไปตัดสต็อกก็ตามสบายเลย
                //ตัวอย่าง: Log::info("ชิ้นนี้คือ: " . $sku);
            }

            $prepareRes = [
                'tracking_number' => $trackingNumber,
                'order_sn' => $orderSn,
                'products' => $products, // ส่งอาเรย์นี้ไปวนลูปหล่อๆ ใน Blade ได้เลย
                'is_packed' => $isPacked
            ];

            return response($prepareRes);

            // หรือส่งต่อให้หางานฝั่ง Frontend (Blade / Vue / React) เอาไปแสดงผล
            // return view('orders.show', [
            //     'tracking_number' => $trackingNumber,
            //     'order_sn' => $orderSn,
            //     'products' => $products, // ส่งอาเรย์นี้ไปวนลูปหล่อๆ ใน Blade ได้เลย
            //     'is_packed' => $isPacked
            // ]);

        } else {
            // กรณี GAS ส่ง status: 'error' กลับมา (เช่น หาคีย์ไม่เจอ)
            return response()->json([
                'status' => 'error',
                'message' => $resData->message ?? 'ไม่พบข้อมูล'
            ], 404);
        }
    }
}
