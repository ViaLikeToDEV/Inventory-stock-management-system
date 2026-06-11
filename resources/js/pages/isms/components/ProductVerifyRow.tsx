import { CheckCircle2, Package } from 'lucide-react';

interface ShopeeProduct {
    sku: string;
    barcode: string | null;
    variant_name: string;
    product_name: string;
    quantity: number;
}

export function ProductVerifyRow({ product, scanned }: { product: ShopeeProduct | any; scanned: number }) {
    // รองรับทั้ง ShopeeProduct และ TikTok Product
    const isShopee = product.quantity !== undefined;
    const qty = isShopee ? product.quantity : Number(product['Quantity']);
    const pName = isShopee ? product.product_name : product['Product Name'];
    const varName = isShopee ? product.variant_name : '';
    const sku = isShopee ? product.sku : '';
    const barcode = isShopee ? product.barcode : '';

    const isDone = scanned >= qty;
    const isPartial = scanned > 0 && !isDone;
    const pct = Math.min(100, Math.round((scanned / qty) * 100));

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isDone ? 'bg-emerald-50 border-emerald-200' : isPartial ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-emerald-100' : isPartial ? 'bg-amber-100' : 'bg-gray-100'}`}>
                {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Package className={`w-5 h-5 ${isPartial ? 'text-amber-600' : 'text-gray-400'}`} />}
            </div>
            <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-medium text-gray-800 truncate" title={pName}>{pName}</p>
                {isShopee && (
                    <p className="text-xs text-gray-400 mt-0.5">
                        {varName === '❌ ไม่พบข้อมูล SKU นี้ในระบบ' ? `SKU: ${sku}` : varName}
                        {barcode && <span className="font-mono ml-2 text-gray-400">{barcode}</span>}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-sm font-semibold min-w-[40px] text-right ${isDone ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-gray-600'}`}>
                    {scanned}/{qty}
                </span>
            </div>
        </div>
    );
}
