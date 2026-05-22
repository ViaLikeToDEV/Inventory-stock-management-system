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

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
        ]);

        try{
            // 1. อ่านข้อมูลจากไฟล์ Excel
            $data = Excel::toArray([], $file);
            $rows = $data[0]; // ดึงข้อมูลจาก Sheet แรก
            $firstRow = $rows[0];
            $sheetType = '';
            $previewData = [];

            //แยกประเภท Sheet แบบง่าย TODO: เดียวมาทำ Validation เพิ่มนะไอค
            if ($firstRow[0] === 'tracking_number' &&
                $firstRow[1] === 'order_sn'){
                $sheetType = 'Shopee';
            } else if($firstRow[0] === 'Order ID' &&
                $firstRow[1] === 'Order Status') {
                $sheetType = 'TiktokShop';
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Format ไฟล์ไม่ถูกต้อง!'
                ], 400);
            }

            if ($sheetType === 'TiktokShop'){
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

            $sheetResponse = Http::post('https://script.google.com/macros/s/AKfycbxXp8SF3wPB2_a1QleyV2KhxEBOrUwUBKbQUhfhK2OLEMZeXQlyMSI1mtC0p-mb9D6r/exec', $previewData);

            // 3. ส่งข้อมูลกลับไปให้ React แสดงผล
            return response()->json([
                'message'      => 'File read success',
                'filename'     => $file->getClientOriginalName(),
                'total_orders' => count($previewData),
                'size' => $file->getSize(),
                'preview_data' => $previewData,
                'sheet_result' => $sheetResponse->json(),
                'sheetType' => $sheetType
            ]);

            ////////////////////////////////////////////////

            } else if ($sheetType === 'Shopee') {
                // 0. ประกาศตัวแปรกองกลางไว้ก่อน กันพังเวลาไม่มีข้อมูลหลุดเข้ามาเลย
                $previewData = [];

                for ($i = 1; $i < count($rows); $i++) {
                    $row = $rows[$i];

                    // เช็คให้ชัวร์ว่าคอลัมน์แรกไม่ได้ว่างเปล่า (กันพวกแถวว่างแถมมา)
                    if (!empty($row[0])) {
                        $rawData = $row[2] ?? ''; // ใช้ ?? ดักเผื่อ index 2 ไม่มีอยู่จริง จะได้ไม่ขึ้น Error

                        // ❌ เปลี่ยนจาก return 400 เป็น continue ข้ามไป เพื่อไม่ให้ตายกลางทาง
                        if (empty($rawData)) {
                            continue;
                        }

                        // 1. แยก String ออกเป็นก้อนๆ ด้วยคำขึ้นต้น [1], [2]
                        $itemsRaw = preg_split('/(?=\[\d+\])/', $rawData, -1, PREG_SPLIT_NO_EMPTY);
                        $parsedItems = [];

                        foreach ($itemsRaw as $itemStr) {
                            $itemStr = trim($itemStr);
                            if (empty($itemStr)) continue;

                            // 2. ใช้ Regex ดึงค่าตาม Key ต่างๆ ออกมา
                            $item = [
                                'sku'      => $this->matchPattern('/เลขอ้างอิง SKU \(SKU Reference No\.\):\s*(.*?);/', $itemStr),
                                'quantity' => (int) $this->matchPattern('/จำนวน:\s*(\d+);/', $itemStr),
                                'price'    => (float) str_replace(['฿', ','], '', $this->matchPattern('/ราคา:\s*฿?([\d,]+)/', $itemStr)),
                            ];

                            $parsedItems[] = $item;
                        }

                        // เพิ่มเข้ากองกลางเฉพาะตอนที่มีการ parse item สำเร็จเท่านั้น
                        if (!empty($parsedItems)) {
                            $previewData[] = [
                                'tracking_number' => (string) $row[0], // Column A (Index 0)
                                'order_sn'        => (string) $row[1], // Column B (Index 1)
                                'product_info'    => json_encode($parsedItems, JSON_UNESCAPED_UNICODE),
                            ];
                        }
                    }
                } // 📌 จบการวนลูปอ่านแถวทั้งหมดตรงนี้

                // เช็คหน่อยว่ามีข้อมูลไปยิงหา Google Apps Script ไหม
                if (empty($previewData)) {
                    return response()->json(['error' => 'No valid order data found in sheet'], 400);
                }

                // จัดโครงสร้างให้ตรงกับก้อนที่ Google Apps Script เวอร์ชันแก้ไขรอรับอยู่
                $searchParameter = [
                    "action" => 'import',
                    "data"   => $previewData,
                ];

                $GAS = 'https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec';

                // ยิงไปหา GAS ด้วย Timeout 15 วินาที
                $GASres = Http::timeout(15)->post($GAS, $searchParameter);

                if ($GASres->failed()) {
                    return response()->json([
                        'error'   => 'Failed to connect to Google Sheets API',
                        'status'  => $GASres->status(),
                        'details' => $GASres->body() // ดึงคำด่าจาก GAS ออกมาดูว่าทำไมไม่ผ่าน
                    ], 500);
                }

                // 3. ส่งข้อมูลกลับไปให้ React แสดงผลแบบสวยๆ
                return response()->json([
                    'preview_data' => $previewData,
                    'sheet_result' => $GASres->json(), // ตัวนี้จะไม่ null แล้ว เพราะฝั่ง GAS บังคับพ่น JSON เสมอ
                    'sheetType'    => $sheetType
                ]);

        } else {
            return response()->json([
                'message' => 'Type incorrect'
            ], 400); // ใส่ HTTP Status 400 ให้หน้าบ้านแยกแยะได้ด้วยว่าส่งประเภทมาผิด
        }

        }catch(\Exception $e){
            return response()->json([
                'message' => 'Error reading file: ' . $e->getMessage()
            ], 500);
        }

    }

    private function matchPattern(string $pattern, string $subject): string
    {
        if (preg_match($pattern, $subject, $matches)) {
            return trim($matches[1]);
        }
        return '';
    }

    public function getOrders()
    {
        // 🚨 อย่าลืมเอา URL ของ Google App Script (ตัวใหม่) มาใส่ในเครื่องหมายคำพูดนะครับ
        $appScriptUrl = 'https://script.google.com/macros/s/AKfycbyi-Pz8el_aChRSp8bqxubT-8tXsEiTsk4P_ZF88r26mSPAnIO2vtvRTcOLGXgUzcxO/exec';

        try {
            $response = Http::get($appScriptUrl);
            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }
}
