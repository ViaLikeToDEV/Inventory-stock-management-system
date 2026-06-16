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

        foreach ($data->sheets->Products->rows as $row) {
            Product::updateOrCreate(
                ['product_id' => $row[0]],
                [
                    'product_name' => $row[1],
                    'is_active' => $row[2] ?? true,
                ]
            );
        }

        foreach ($data->sheets->Variants->rows as $row) {
            Variant::updateOrCreate(
                ['sku' => $row[0]],
                [
                    'product_id'   => $row[1],
                    'variant_name' => $row[2],
                    'barcode'      => $row[3] ?? null,
                    'bundle'       => $row[5] ?? null,
                    'is_active' => $row[4] ?? true,
                ]
            );
        }
    }
}
