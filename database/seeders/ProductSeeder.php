<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\Variant;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\Http;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $searchParameter = [
            'action' => 'productsinfolists'
        ];

        $GAS = config('services.products_script_url');

        $response = Http::timeout(15)->post($GAS, $searchParameter);
        $data = $response->object();

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
                    'is_active' => $row[4] ?? true,
                ]
            );
        }
    }
}
