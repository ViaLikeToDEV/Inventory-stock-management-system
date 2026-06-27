<?php
// app/Normalizers/GasProductNormalizer.php
namespace App\Normalizers;

use App\DTOs\RawProductData;
use App\DTOs\RequiredProductData;


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

    public static function requiredProducts_normalize(array $products): array
    {
        return array_map(fn($p) => new RequiredProductData(
            sku:      $p->sku,
            packed:   $p->packed,
            unpacked: $p->unpacked,
            total:    $p->total,
        ), $products);
    }
}
