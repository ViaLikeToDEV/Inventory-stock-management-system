<?php
// app/Normalizers/GasProductNormalizer.php
namespace App\Normalizers;

use App\DTOs\RawProductData;

class GasProductNormalizer
{
    /** @return RawProductData[] */
    public static function normalize(array $products): array
    {
        return array_map(fn($p) => new RawProductData(
            sku:      $p->sku,
            quantity: $p->quantity ?? 0,
            price:    $p->price ?? 0,
        ), $products);
    }
}
