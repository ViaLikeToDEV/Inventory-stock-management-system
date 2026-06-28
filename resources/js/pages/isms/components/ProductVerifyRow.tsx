// components/ProductVerifyRow.tsx
import { CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react';

interface UnifiedProduct {
    product_name: string;
    variant_name: string;
    sku: string;
    barcode: string;
    quantity: number;
}

interface ProductVerifyRowProps {
    product: any; // รองรับโครงสร้างดิบจากทั้งสองแพลตฟอร์ม
    scanned: number;
}

export function ProductVerifyRow({ product, scanned }: ProductVerifyRowProps) {
    // 1. Normalize data ให้เป็นมาตรฐานเดียวกัน ลดภาระการคำนวณใน UI
    const isShopee = product.quantity !== undefined;

    const normalized: UnifiedProduct = {
        product_name: isShopee ? product.product_name : (product['Product Name'] || ''),
        variant_name: isShopee ? product.variant_name : (product['Variant Name'] || ''),
        sku: isShopee ? product.sku : (product['Seller SKU'] || product['SKU'] || ''),
        barcode: isShopee ? product.barcode : (product['Barcode'] || ''),
        quantity: isShopee ? Number(product.quantity) : Number(product['Quantity'] || 0)
    };

    const qty = normalized.quantity;
    const isDone = scanned >= qty;
    const isPartial = scanned > 0 && !isDone;
    const isMissingSku = normalized.variant_name.includes('ไม่พบข้อมูล') || !normalized.sku;

    return (
        <div className={`flex items-center justify-between gap-6 p-5 rounded-xl border-3 transition-all duration-150 ${
            isDone
                ? 'bg-emerald-50 border-emerald-500 shadow-sm opacity-85' // ครบแล้วลดความเด่นลงหน่อย สายตาจะได้โฟกัสชิ้นที่เหลือ
                : isPartial
                ? 'bg-amber-50 border-amber-500 shadow-md animate-pulse-subtle' // กำลังทำอยู่ ต้องเด่นขึ้นมา
                : isMissingSku
                ? 'bg-rose-50 border-rose-400'
                : 'bg-white border-gray-300'
        }`}>

            {/* โซนซ้าย: ข้อมูลสินค้า ขยายเต็มที่ */}
            <div className="flex-1 min-w-0 space-y-3">
                {/* แหล่งที่มา + SKU/Barcode Badge */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isShopee ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-black text-white'
                    }`}>
                        {isShopee ? 'Shopee' : 'TikTok'}
                    </span> */}

                    {normalized.sku && (
                        <span className="font-mono text-sm font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-300 select-all">
                            SKU: {normalized.sku}
                        </span>
                    )}

                    {normalized.barcode && (
                        <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                            {normalized.barcode}
                        </span>
                    )}
                </div>

                {/* ชื่อสินค้า: เน้นขนาดให้อ่านง่าย ไม่ตัดคำทิ้งในจุดสำคัญ */}
                <h3 className="text-lg font-bold text-gray-900 leading-snug break-words">
                    {normalized.product_name}
                </h3>

                {/* ตัวเลือกสินค้า (Variant) แยกบล็อกให้ชัดเจน ถ้าพังหรือไม่มีให้เตือนตัวโตๆ */}
                {isMissingSku ? (
                    <div className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-100 px-3 py-1 rounded-lg text-sm font-black border border-rose-300">
                        <AlertCircle className="w-4 h-4" />
                        ไม่พบข้อมูล SKU ในระบบพิกัด
                    </div>
                ) : (
                    normalized.variant_name && (
                        <div className="inline-block bg-slate-100 text-slate-800 text-sm font-semibold px-3 py-1 rounded-lg border border-slate-200">
                            ตัวเลือก: <span className="text-indigo-700 font-bold">{normalized.variant_name}</span>
                        </div>
                    )
                )}
            </div>

            {/* โซนขวา: ตัวเลขและสถานะการแพ็ก (ยักษ์ใหญ่ สังเกตง่ายที่สุด) */}
            <div className="flex flex-col items-end justify-center gap-2 flex-shrink-0 min-w-[140px]">
                <div className="text-right">
                    <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Scanned</span>
                    <div className="inline-flex items-baseline font-mono tracking-tight">
                        <span className={`text-4xl font-black ${
                            isDone ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                            {scanned}
                        </span>
                        <span className="text-2xl font-bold text-gray-400 mx-1">/</span>
                        <span className="text-2xl font-bold text-gray-700">{qty}</span>
                    </div>
                </div>

                {/* Indicator Badge สถานะท้ายแถว */}
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase ${
                    isDone
                        ? 'bg-emerald-600 text-white'
                        : isPartial
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                }`}>
                    {isDone ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                            <span>DONE</span>
                        </>
                    ) : isPartial ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span>PACKING</span>
                        </>
                    ) : (
                        <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>WAITING</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
