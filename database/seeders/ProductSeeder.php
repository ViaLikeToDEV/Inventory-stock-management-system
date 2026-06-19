<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Variant;
use App\Models\SystemSetting;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\Http;
use Illuminate\Database\Seeder;

use Exception;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $searchParameter = [
            'action' => 'productsinfolists'
        ];

        $GAS = config('services.products_script_url');

        $response = Http::timeout(15)->post($GAS, $searchParameter);

        if ($response->failed()) {
            throw new Exception("API Request failed with status: " . $response->status());
        }

        $data = $response->object();

        // เช็ค status ที่ส่งมาจาก GAS
        if (isset($data->status) && $data->status === 'warning') {
            // ดึง message ที่คุณ custom ไว้ใน GAS ออกมาโชว์ด้วยเลย เจ๋งกว่าเยอะ!
            $errorMessage = $data->message ?? 'GAS API returned a warning status.';
            throw new Exception("GAS Warning: " . $errorMessage);
        }

        if (isset($data->version)){
            SystemSetting::updateOrCreate(
                ['key' => 'shopee_gas_version'],
                ['value' => $data->version]
            );
        }

        $apiProductIds = [];
        foreach ($data->sheets->Products->rows as $row) {
            $productId = $row[0];
            $apiProductIds[] = $productId; // เก็บ ID ที่มีอยู่ใน G-Sheet รอบนี้ทั้งหมดไว้

            Product::updateOrCreate(
                ['product_id' => $productId],
                [
                    'product_name' => $row[1],
                    'is_active'    => $row[2] ?? true,
                ]
            );
        }
        // ตัวไหนที่อยู่ใน DB แต่ไม่อยู่ในลิสต์รอบนี้ = โดนลบ หรือโดนเปลี่ยน ID ไปแล้ว -> ลบทิ้งซะ
        Product::whereNotIn('product_id', $apiProductIds)->delete();


        // --- 2. จัดการฝั่ง Variants ---
        $apiSkus = [];
        foreach ($data->sheets->Variants->rows as $row) {
            $sku = $row[0];
            $apiSkus[] = $sku; // เก็บ SKU ที่มีอยู่ใน G-Sheet รอบนี้ทั้งหมดไว้

            Variant::updateOrCreate(
                ['sku' => $sku],
                [
                    'product_id'   => $row[1],
                    'variant_name' => $row[2],
                    'barcode'      => $row[3] ?? null,
                    'bundle'       => $row[5] ?? null,
                    'is_active'    => $row[4] ?? true,
                ]
            );
        }
        // แก้ปัญหา Duplicate กระจุย! ตัวไหนเป็น SKU เก่าที่ฝั่ง G-Sheet แก้ชื่อไปแล้ว
        // มันจะไม่เหลือรอดใน DB เพราะจะโดนสั่งลบด้วยคำสั่งนี้ทันที
        Variant::whereNotIn('sku', $apiSkus)->delete();
    }
}
