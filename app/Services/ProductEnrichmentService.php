<?php

// app/Services/ProductEnrichmentService.php
namespace App\Services;

use App\DTOs\RawProductData;
use App\Models\Variant;

class ProductEnrichmentService
{
    /** @param RawProductData[] $products */
    public function enrich(array $products): array
    {
        $skus = array_map(fn(RawProductData $p) => $p->sku, $products);

        $dbVariants = Variant::with('product')
            ->whereIn('sku', $skus)
            ->get()
            ->keyBy('sku');

        $enriched = [];

        foreach ($products as $product) {
            $variant = $dbVariants->get($product->sku);
            $bundle  = $variant?->bundle ?? null;

            if ($bundle) {
                array_push($enriched, ...$this->expandBundle($product, $bundle));
            } else {
                $enriched[] = $this->mapSingleProduct($product, $variant);
            }
        }

        return $enriched;
    }

    private function expandBundle(RawProductData $origin, string $bundleJson): array
    {
        $bundleData = json_decode($bundleJson);
        $result     = [];

        foreach ($bundleData as $index => $item) {
            $result[] = match ($item->type) {
                'origin_sku' => $this->mapOriginSkuItem($origin, $index, $item),
                'dummy_item' => $this->mapDummyItem($origin, $index, $item),
                default      => null,
            };
        }

        return array_filter($result);
    }

    private function mapOriginSkuItem(RawProductData $origin, int|string $index, object $item): array
    {
        $originSku = Variant::with('product')->where('sku', $item->sku)->first();

        return [
            'sku'          => "{$origin->sku}_{$index}_{$item->sku}",
            'variant_name' => $item->display_variant      ?? $originSku?->variant_name          ?? '❌ ไม่พบ Origin_SKU',
            'product_name' => $item->display_product_name ?? $originSku?->product?->product_name ?? '❌ ไม่พบข้อมูล',
            'barcode'      => $originSku?->barcode        ?? null,
            'is_active'    => $originSku?->is_active      ?? false,
            'quantity'     => isset($item->quantity) ? $origin->quantity * $item->quantity : 0,
        ];
    }

    private function mapDummyItem(RawProductData $origin, int|string $index, object $item): array
    {
        return [
            'sku'          => "{$origin->sku}_{$index}_{$item->display_variant}",
            'variant_name' => $item->display_variant      ?? '❌ ไม่พบ dummy_item_variant',
            'product_name' => $item->display_product_name ?? '❌ ไม่พบข้อมูล',
            'barcode'      => $item->barcode              ?? null,
            'is_active'    => true,
            'quantity'     => isset($item->quantity) ? $origin->quantity * $item->quantity : 0,
        ];
    }

    private function mapSingleProduct(RawProductData $product, ?Variant $variant): array
    {
        return [
            'sku'          => $product->sku,
            'variant_name' => $variant?->variant_name          ?? '❌ ไม่พบ SKU นี้ในระบบ',
            'product_name' => $variant?->product?->product_name ?? '❌ ไม่พบข้อมูล',
            'barcode'      => $variant?->barcode               ?? null,
            'is_active'    => $variant?->is_active             ?? false,
            'quantity'     => $product->quantity,
        ];
    }
}
