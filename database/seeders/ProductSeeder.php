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

        $GAS = 'https://script.google.com/macros/s/AKfycbzGBzLR_xekkOw7U2xZ9FE0fGj0SW8XDRy6zfCpbp5fXUx_9J9l-Lf6z5gogtcFnAZrCw/exec';

        $response = Http::timeout(15)->post($GAS, $searchParameter);
        $data = $response->object();

        foreach ($data->sheets->Products->rows as $row) {
            Product::updateOrCreate(
                ['product_id' => $row[0]],
                ['product_name' => $row[1]]
            );
        }

        foreach ($data->sheets->Variants->rows as $row) {
            Variant::updateOrCreate(
                ['sku' => $row[0]],
                [
                    'product_id'   => $row[1],
                    'variant_name' => $row[2],
                    'barcode'      => $row[3] ?? null,
                ]
            );
        }
    }
}
