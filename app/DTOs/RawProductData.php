<?php

// app/DTOs/RawProductData.php
namespace App\DTOs;

readonly class RawProductData
{
    public function __construct(
        public string  $sku,
        public int     $quantity,
        public float   $price,
        public ?string $variant_name = null,
        public ?string $product_name = null,
    ) {}
}
