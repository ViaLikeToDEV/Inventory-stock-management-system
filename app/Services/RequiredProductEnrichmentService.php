<?php

namespace App\Services;

use App\DTOs\RequiredProductData;
use App\Models\Variant;
use Illuminate\Support\Collection;

class RequiredProductEnrichmentService
{
    /** @param RequiredProductData[] $products */
    public function enrich(array $products): array
    {
        $skus = array_map(fn(RequiredProductData $p) => $p->sku, $products);

        // 1. ดึงข้อมูล Variants หลัก
        $dbVariants = Variant::with('product')
            ->whereIn('sku', $skus)
            ->get()
            ->keyBy('sku');

        // 2. [แก้ N+1] รวบรวม SKU ทั้งหมดที่ซ่อนอยู่ใน BundleJson เพื่อดึงข้อมูลทีเดียว
        $bundleSkus = [];
        foreach ($products as $product) {
            $variant = $dbVariants->get($product->sku);
            $bundleJson = $variant?->bundle;
            if ($bundleJson) {
                $bundleData = json_decode($bundleJson);
                if (is_array($bundleData)) {
                    foreach ($bundleData as $item) {
                        if (($item->type ?? null) === 'origin_sku' && !empty($item->sku)) {
                            $bundleSkus[] = $item->sku;
                        }
                    }
                }
            }
        }

        // ดึงข้อมูล Variant ของไอเทมใน Bundle มารอไว้เลย
        $bundleVariants = empty($bundleSkus)
            ? collect()
            : Variant::with('product')->whereIn('sku', array_unique($bundleSkus))->get()->keyBy('sku');

        $enrichedRaw = [];

        foreach ($products as $product) {
            $variant = $dbVariants->get($product->sku);
            $bundle  = $variant?->bundle ?? null;

            if ($bundle) {
                // ส่ง $bundleVariants เข้าไปด้วยเพื่อเลิกใช้ N+1
                array_push($enrichedRaw, ...$this->expandBundle($product, $bundle, $bundleVariants));
            } else {
                $enrichedRaw[] = $this->mapSingleProduct($product, $variant);
            }
        }

        // 3. [แก้ปัญหา SKU ซ้ำ] Group By SKU แล้ว Sum ยอดที่ซ้ำกันซะ
        return collect($enrichedRaw)
            ->filter()
            ->groupBy('sku')
            ->map(function (Collection $items) {
                // ดึงตัวแรกมาเป็น Base template ข้อมูลพื้นฐาน
                $first = $items->first();

                // รวมผลรวมจำนวนทั้งหมดเข้าด้วยกัน
                $first['packed']   = $items->sum('packed');
                $first['unpacked'] = $items->sum('unpacked');
                $first['total']    = $items->sum('total');

                return $first;
            })
            ->values()
            ->toArray();
    }

    private function expandBundle(RequiredProductData $origin, string $bundleJson, Collection $bundleVariants): array
    {
        $bundleData = json_decode($bundleJson);
        if (!is_array($bundleData)) return [];

        $result = [];

        foreach ($bundleData as $index => $item) {
            $result[] = match ($item->type ?? null) {
                'origin_sku' => $this->mapOriginSkuItem($origin, $index, $item, $bundleVariants),
                'dummy_item' => $this->mapDummyItem($origin, $index, $item),
                default      => null,
            };
        }

        return array_filter($result);
    }

    private function mapOriginSkuItem(RequiredProductData $origin, int|string $index, object $item, Collection $bundleVariants): array
    {
        // ดึงจาก Collection แทนการคิวรี่ DB ใหม่ในลูป
        $originSku = $bundleVariants->get($item->sku);
        $ratio     = $item->quantity ?? 0;

        return [
            'sku'          => $item->sku,
            'variant_name' => $item->display_variant      ?? $originSku?->variant_name           ?? '❌ ไม่พบ Origin_SKU',
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
            'sku'          => "{$origin->sku}_{$index}_" . ($item->display_variant ?? 'dummy'),
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
