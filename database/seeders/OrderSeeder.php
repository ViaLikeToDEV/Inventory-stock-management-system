<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use App\Models\Order;
use App\Models\OrderItem;
use Carbon\Carbon;

class OrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ⚠️ เอา URL GAS ของแกมาใส่ตรงนี้ แนะนำว่าใช้งานจริงควรดึงจาก env('GAS_WEBHOOK_URL') จะหล่อกว่า
        $gasUrl = config('services.shopee_script_url');

        $this->command->info('🚀 กำลังยิง Request ไปดึงข้อมูลจาก GAS...');

        // ดูจากโค้ด GAS มันรับ payload หน้าตาแบบนี้
        $response = Http::post($gasUrl, [
            'action' => 'query_unpacked',
        ]);

        // เช็กก่อนว่ายิงติดมั้ย เผื่อเน็ตหลุดหรือ URL ผิด
        if ($response->failed()) {
            $this->command->error('❌ ยิง API ไม่ผ่านว่ะ เช็ก URL กับ Network ด่วนเลย');
            return;
        }

        $payload = $response->json();

        // เช็ก Data ที่ Return กลับมาว่า Success จริงและมีของมั้ย
        if (!$payload || empty($payload['success']) || empty($payload['data'])) {
            $this->command->warn('⚠️ GAS ตอบกลับมานะ แต่มันบอกว่าไม่ success หรือไม่มี Data ให้ Seed (ออเดอร์อาจจะว่าง)');
            return;
        }

        $this->command->info('✅ ดึงข้อมูลมาได้ละ ' . count($payload['data']) . ' ออเดอร์ กำลังปั่นลง DB...');
        $orderCleaner = [];

        foreach ($payload['data'] as $orderData) {
            // หั่น YearMonth
            // [$year, $month] = explode('-', $orderData['YearMonth']);

            // 1. สร้างหรืออัปเดต Order
            $order = Order::updateOrCreate(
                ['order_sn' => $orderData['order_sn']],
                [
                    'tracking_number' => $orderData['tracking_number'],
                    'timestamp' => Carbon::parse($orderData['TimeStamp']),
                    'is_packed' => (bool)$orderData['IsPacked'],
                    'packed_at' => !empty($orderData['PackedAt']) ? Carbon::parse($orderData['PackedAt']) : null,
                    'is_active' => (bool)$orderData['IsActive'],
                ]
            );
            $orderCleaner[] = $orderData['order_sn'];

            // 2. ปั้นก้อน Items
            $items = [];
            if (!empty($orderData['product_info_sku'])) {
                foreach ($orderData['product_info_sku'] as $item) {
                    $items[] = new OrderItem([
                        'sku' => $item['sku'],
                        'quantity' => $item['quantity'],
                        'price' => $item['price'],
                    ]);
                }
            }

            // 3. ลบของเก่าแล้วเซฟใหม่ (Data Integrity)
            $order->items()->delete();
            if (count($items) > 0) {
                $order->items()->saveMany($items);
            }
        }
        Order::whereNotIn('order_sn', $orderCleaner)->delete();

        $this->command->info('🔥 Seed ออเดอร์จาก GAS ลง DB เรียบร้อยแบบตึงๆ!');
    }
}
