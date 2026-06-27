<?php

// app/Services/ProductEnrichmentService.php
namespace App\Services;

use App\DTOs\RequiredProductData;
use App\Models\Variant;

class RequiredProductEnrichmentService
{
    /** @param RequiredProductData[] $products */
    public function enrich(array $products): array
    {
        $skus = array_map(fn(RequiredProductData $p) => $p->sku, $products);

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

    private function expandBundle(RequiredProductData $origin, string $bundleJson): array
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

    private function mapOriginSkuItem(RequiredProductData $origin, int|string $index, object $item): array
    {
        $originSku = Variant::with('product')->where('sku', $item->sku)->first();
        $ratio     = $item->quantity ?? 0;

        return [
            'sku'          => "{$origin->sku}_{$index}_{$item->sku}",
            'variant_name' => $item->display_variant      ?? $originSku?->variant_name          ?? '❌ ไม่พบ Origin_SKU',
            'product_name' => $item->display_product_name ?? $originSku?->product?->product_name ?? '❌ ไม่พบข้อมูล',
            'barcode'      => $originSku?->barcode        ?? null,
            'is_active'    => $originSku?->is_active      ?? false,
            'packed'       => $origin->packed   * $ratio,
            'unpacked'     => $origin->unpacked * $ratio,
            'total'        => $origin->total    * $ratio,
        ];
    }

    private function mapDummyItem(RequiredProductData $origin, int|string $index, object $item): array
    {
        $ratio = $item->quantity ?? 0;

        return [
            'sku'          => "{$origin->sku}_{$index}_{$item->display_variant}",
            'variant_name' => $item->display_variant      ?? '❌ ไม่พบ dummy_item_variant',
            'product_name' => $item->display_product_name ?? '❌ ไม่พบข้อมูล',
            'barcode'      => $item->barcode              ?? null,
            'is_active'    => true,
            'packed'       => $origin->packed   * $ratio,
            'unpacked'     => $origin->unpacked * $ratio,
            'total'        => $origin->total    * $ratio,
        ];
    }

    private function mapSingleProduct(RequiredProductData $product, ?Variant $variant): array
    {
        return [
            'sku'          => $product->sku,
            'variant_name' => $variant?->variant_name           ?? '❌ ไม่พบ SKU นี้ในระบบ',
            'product_name' => $variant?->product?->product_name ?? '❌ ไม่พบข้อมูล',
            'barcode'      => $variant?->barcode                ?? null,
            'is_active'    => $variant?->is_active              ?? false,
            'packed'       => $product->packed,
            'unpacked'     => $product->unpacked,
            'total'        => $product->total,
        ];
    }
}
