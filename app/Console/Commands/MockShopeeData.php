<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MockShopeeData extends Command
{
    /**
     * ชื่อคำสั่งในการเรียกใช้งานผ่าน Artisan
     */
    protected $signature = 'shopee:mock
                            {total=1000 : จำนวนข้อมูลทั้งหมดที่ต้องการสร้าง}
                            {chunk=100 : จำนวนรายการต่อการยิง 1 Batch}';

    protected $description = 'ระเบิดข้อมูล Mockup ปริมาณมากเข้า Google Sheets เพื่อทดสอบ Performance';

    public function handle()
    {
        $gasUrl = 'https://script.google.com/macros/s/AKfycbzL9eu8Z-JmerV7k8j2zqr2H97imIj46xNIr1YchAESkv9LkZqQS_LTMEc_0m8umaTf/exec';


        $total = (int) $this->argument('total');
        $chunkSize = (int) $this->argument('chunk');

        $this->info("🚀 เริ่มต้นระบบสร้างข้อมูลจำลองจำนวน {$total} รายการ (สับก้อนละ {$chunkSize})...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $currentCount = 0;

        while ($currentCount < $total) {
            // คำนวณจำนวนที่ต้องสร้างในรอบนี้ (ป้องกันรอบสุดท้ายเกินเป้า)
            $remaining = $total - $currentCount;
            $currentChunkSize = min($chunkSize, $remaining);

            $rows = [];
            for ($i = 0; $i < $currentChunkSize; $i++) {
                // จำลองข้อมูลที่มีฟอร์แมตใกล้เคียงความจริง
                $trackingNum = 'TH' . rand(20000000, 29999999) . rand(100000, 999999) . chr(rand(65, 90));
                $orderSn = rand(260000, 269999) . Str::upper(Str::random(8));

                // สุ่มสร้างสินค้าในตระกูล SKU JSON ให้เหมือน Schema
                $skuMock = [
                    [
                        'sku' => collect(['มาม่าต้มยำกุ้ง', 'โจ๊กคละ 4 รส', 'ปลากระป๋องสามแม่ครัว', 'น้ำดื่มสิงห์'])->random(),
                        'quantity' => rand(1, 10),
                        'price' => rand(15, 300)
                    ]
                ];

                // แพ็กข้อมูลให้ตรงกับที่ GAS ต้องการ (GAS มองหา order.product_info ไม่ใช่ product_info_sku)
                // ส่วน TimeStamp ทางฝั่ง GAS ทำการ Stamp ให้เองด้วย var today = new Date(); อยู่แล้ว
                $rows[] = [
                    'tracking_number'  => $trackingNum,
                    'order_sn'         => $orderSn,
                    'product_info'     => json_encode($skuMock, JSON_UNESCAPED_UNICODE),
                ];
            }

            // ⚠️ แก้ Payload ยิงถล่ม GAS ให้ตรงกับที่มันรอรับ
            $payload = [
                'action' => 'import', // เปลี่ยนจาก 'insert' เป็น 'import'
                'data'   => $rows     // เปลี่ยนจาก 'rows' เป็น 'data'
            ];

            // ส่งข้อมูลไปยังฝั่ง Google Apps Script
            try {
                // ตั้งค่า Timeout ไว้ 30s
                $response = Http::timeout(30)->post($gasUrl, $payload);

                if ($response->failed()) {
                    $this->newLine();
                    $this->error("❌ [Batch Failed] GAS ตอบกลับด้วย HTTP Status: " . $response->status());
                    break;
                }

                $result = $response->json();

                // เช็คสถานะการตอบกลับแบบใหม่ตามที่ GAS ส่งกลับมา (GAS ส่ง status: 'error' ไม่ใช่ success: false)
                if (isset($result['status']) && $result['status'] === 'error') {
                    $this->newLine();
                    $this->error("❌ [GAS Internal Error] " . ($result['message'] ?? 'ไม่ทราบสาเหตุ'));
                    break;
                }

            } catch (\Exception $e) {
                $this->newLine();
                $this->error("💥 [Network Error] พังจ้า: " . $e->getMessage());
                break;
            }

            // อัปเดต Progress Bar บน Terminal
            $currentCount += $currentChunkSize;
            $bar->advance($currentChunkSize);

            // ─── CRITICAL SLEEP ───────────────────────────────────────
            // หน่วงเวลา 1.5 วินาที เพื่อปล่อยให้ LockService/API Quota ใน GAS คลายตัว
            if ($currentCount < $total) {
                usleep(1500000);
            }
        }

        $bar->finish();
        $this->newLine();
        $this->info("✨ เสร็จสิ้นภารกิจ! ยิงข้อมูลจำลองเข้าคลังสำเร็จทั้งหมด {$currentCount} รายการ");
    }
}
