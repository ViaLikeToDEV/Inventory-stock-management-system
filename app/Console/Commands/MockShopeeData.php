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
        $gasUrl = 'https://script.google.com/macros/s/AKfycbzwB9taqtlBjTkhsCvNf0GnEpfc0tCljMLVQspJB8g64m7E48UeSO2oG5PQ11642210/exec';

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
                $trackingNum = 'TH' . rand(20000000, 29999999) . rand(100000, 999999) . chr(rand(65, 90)); // เช่น TH267097911330J
                $orderSn = rand(260000, 269999) . Str::upper(Str::random(8)); // เช่น 260505HYJKR5VT

                // สุ่มสร้างสินค้าในตระกูล SKU JSON
                $skuMock = [
                    [
                        'sku' => collect(['มาม่าต้มยำกุ้ง', 'โจ๊กคละ 4 รส', 'ปลากระป๋องสามแม่ครัว', 'น้ำดื่มสิงห์'])->random(),
                        'quantity' => rand(1, 10),
                        'price' => rand(15, 300)
                    ]
                ];

                // สุ่มถอยเวลากลับไปในช่วง 3 เดือนที่ผ่านมา เพื่อกระจายคีย์ YearMonth ในตาราง
                $randomDaysAgo = rand(0, 90);
                $timestamp = now()->subDays($randomDaysAgo)->toIso8601String();

                $rows[] = [
                    'tracking_number'  => $trackingNum,
                    'order_sn'         => $orderSn,
                    'product_info_sku' => json_encode($skuMock, JSON_UNESCAPED_UNICODE),
                    'timestamp'        => $timestamp,
                ];
            }

            // เตรียม Payload ยิงถล่ม GAS
            $payload = [
                'action' => 'insert',
                'rows'   => $rows
            ];

            // ส่งข้อมูลไปยังฝั่ง Google Apps Script
            try {
                // ตั้งค่า Timeout ไว้สูงนิดนึง (30s) เผื่อแผ่นงานคำนวณช้าเมื่อข้อมูลเยอะขึ้น
                $response = Http::timeout(30)->post($gasUrl, $payload);

                if ($response->failed()) {
                    $this->newLine();
                    $this->error("❌ [Batch Failed] GAS ตอบกลับด้วย HTTP Status: " . $response->status());
                    break;
                }

                $result = $response->json();
                if (isset($result['success']) && !$result['success']) {
                    $this->newLine();
                    $this->error("❌ [GAS Internal Error] " . ($result['error'] ?? 'ไม่ทราบสาเหตุ'));
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
            // หน่วงเวลา 1.5 วินาที เพื่อปล่อยให้ LockService ใน GAS คลายตัว
            // ป้องกันปัญหากลุ่ม Request ชนกันเองจนเกิดอาการ Server Busy (Lock Timeout)
            if ($currentCount < $total) {
                usleep(1500000);
            }
        }

        $bar->finish();
        $this->newLine();
        $this->info("✨ เสร็จสิ้นภารกิจ! ยิงข้อมูลจำลองเข้าคลังสำนเร็จทั้งหมด {$currentCount} รายการ");
    }
}
