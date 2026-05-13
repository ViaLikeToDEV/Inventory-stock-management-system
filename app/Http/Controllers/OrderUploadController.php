<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Http;

class OrderUploadController extends Controller
{
    //
    public function upload(Request $request)
    {
        $file = $request->file('file');

        if (!$file) {
            return response()->json([
                'message' => 'No file uploaded'
            ], 400);
        }


        try{
            // 1. อ่านข้อมูลจากไฟล์ Excel
            $data = Excel::toArray([], $file);
            $rows = $data[0]; // ดึงข้อมูลจาก Sheet แรก

            $previewData = [];

            // 2. วนลูปข้อมูล (เริ่มที่ index 2 เพราะข้ามแถวหัวข้อ 0 และ 1)
            for ($i = 2; $i < count($rows); $i++) {
                $row = $rows[$i];

                // เช็คให้ชัวร์ว่าคอลัมน์ Order ID ไม่ได้ว่างเปล่า (กันพวกแถวว่างแถมมา)
                if (!empty($row[0])) {
                    $previewData[] = [
                        'order_id'     => (string) $row[0], // Column A (Index 0)
                        'product_name' => (string) $row[7], // Column H (Index 7)
                        'quantity' => (string) $row[9]
                    ];
                }
            }

            $sheetResponse = Http::post('https://script.google.com/macros/s/AKfycbz5fbFTM2223vJYYwM0-oxbgpzeCa3zRn0ZBppaZXhQ4nCVZQ8pXKca8OyKC-UC1v3P/exec', $previewData);

            // 3. ส่งข้อมูลกลับไปให้ React แสดงผล
            return response()->json([
                'message'      => 'File read success',
                'filename'     => $file->getClientOriginalName(),
                'total_orders' => count($previewData),
                'size' => $file->getSize(),
                'preview_data' => $previewData,
                'sheet_result' => $sheetResponse->json()
            ]);

        }catch(\Exception $e){
            return response()->json([
                'message' => 'Error reading file: ' . $e->getMessage()
            ], 500);
        }


    }
}
