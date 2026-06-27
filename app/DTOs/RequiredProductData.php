<?php

namespace App\DTOs;

readonly class RequiredProductData {
    public function __construct(
        public string $sku,
        public int $packed,
        public int $unpacked,
        public int $total,
        public ?string $variant_name = null,
        public ?string $product_name = null,
        )
    {}
}
