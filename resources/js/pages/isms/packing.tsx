import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag, ScanLine, CheckCircle2, AlertCircle, Package, Clock as ClockIcon} from 'lucide-react';
import axios from 'axios';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Platform = 'tiktok' | 'shopee';
type ShopeeMode = 'search' | 'skunotfound';

interface ShopeeProduct {
    sku: string;
    barcode: string | null;
    variant_name: string;
    product_name: string;
    quantity: number;
}

interface ShopeeOrder {
    tracking_number: string;
    order_sn: string;
    is_packed: number;
    products: ShopeeProduct[];
}

// ─────────────────────────────────────────────
// Sub-component: Status Bar
// ─────────────────────────────────────────────
function ScannerStatusBar({ isFocused, mode }: { isFocused: boolean; mode: ShopeeMode }) {
    const label = mode === 'search'
        ? (isFocused ? 'พร้อมรับบาร์โค้ด — สแกนหรือพิมพ์ได้เลย' : 'คลิกที่ช่องค้นหาเพื่อเริ่มสแกน')
        : (isFocused ? 'พร้อมสแกนสินค้า — วาง barcode ที่ scanner' : 'กล่องรับสแกนไม่มี focus — คลิกที่ช่องก่อน');

    const modeTag = mode === 'search' ? 'SEARCH MODE' : 'VERIFY MODE';

    return (
        <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                isFocused
                    ? mode === 'search'
                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                        : 'bg-blue-50 border border-blue-300 text-blue-800'
                    : 'bg-gray-100 border border-gray-200 text-gray-500'
            }`}
        >
            {/* Pulse dot */}
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                {isFocused && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${
                        mode === 'search' ? 'bg-emerald-400' : 'bg-blue-400'
                    }`} />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isFocused
                        ? mode === 'search' ? 'bg-emerald-500' : 'bg-blue-500'
                        : 'bg-gray-400'
                }`} />
            </span>
            <ScanLine className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                isFocused
                    ? mode === 'search' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-500'
            }`}>
                {modeTag}
            </span>
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-component: Product Row (Verify Mode)
// ─────────────────────────────────────────────
function ProductVerifyRow({ product, scanned }: { product: ShopeeProduct; scanned: number }) {
    const isDone = scanned >= product.quantity;
    const isPartial = scanned > 0 && !isDone;
    const pct = Math.min(100, Math.round((scanned / product.quantity) * 100));

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
            isDone
                ? 'bg-emerald-50 border-emerald-200'
                : isPartial
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-gray-200'
        }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isDone ? 'bg-emerald-100' : isPartial ? 'bg-amber-100' : 'bg-gray-100'
            }`}>
                {isDone
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <Package className={`w-5 h-5 ${isPartial ? 'text-amber-600' : 'text-gray-400'}`} />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{product.product_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                    {product.variant_name === '❌ ไม่พบข้อมูล SKU นี้ในระบบ' ? `SKU: ${product.sku}` : product.variant_name}
                    {product.barcode && (
                        <span className="font-mono ml-2 text-gray-400">{product.barcode}</span>
                    )}
                </p>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
                {/* Progress bar */}
                <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${
                            isDone ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-gray-300'
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <span className={`text-sm font-semibold min-w-[40px] text-right ${
                    isDone ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-gray-600'
                }`}>
                    {scanned}/{product.quantity}
                </span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-component: Shopee Panel (Search + Verify)
// ─────────────────────────────────────────────
function ShopeePanel({ onOrderFound }: { onOrderFound: (order: ShopeeOrder) => void }) {
    const [shopeeMode, setShopeeMode] = useState<ShopeeMode>('search');
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [orderData, setOrderData] = useState<ShopeeOrder | null>(null);
    const [scanCounts, setScanCounts] = useState<Record<string, number>>({});
    const [unknownBarcode, setUnknownBarcode] = useState('');
    const [flashKey, setFlashKey] = useState(0);
    const [invalidProducts, setInvalidProducts] = useState<ShopeeProduct[]>([]);

    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const resetToSearch = useCallback(() => {
        setShopeeMode('search');
        setOrderData(null);
        setScanCounts({});
        setQuery('');
        setErrorMsg('');
        setUnknownBarcode('');
        setTimeout(() => {
            inputRef.current?.focus();
            setIsFocused(true);
        }, 100);
    }, []);

    // 🟩 แยกฟังก์ชัน handleSync ออกมาด้านนอกเพื่อให้เรียกใช้ง่ายๆ
    const handleSync = async () => {
        // 1. ดึง SweetAlert2 มาเตรียมไว้
        const Swal = (await import('sweetalert2')).default;

        // 2. ขึ้น Pop-up กำลังโหลด (บล็อกหน้าจอไม่ให้ยูสเซอร์กดซ้ำ)
        Swal.fire({
            title: 'กำลังซิงค์ข้อมูล...',
            text: 'กรุณารอสักครู่ ระบบกำลังเชื่อมต่อกับ Shopee',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading(); // แสดง Spinner หมุน ๆ
            }
        });

        try {
            const res = await fetch('/api/sync-products', { method: 'POST' });

            // เช็กด้วยว่ายิง API สำเร็จไหม (ถ้า HTTP status ไม่ใช่ 2xx ให้ตกไป catch)
            if (!res.ok) throw new Error('ยิง API ไม่สำเร็จ');

            const data = await res.json();

            // 3. ซิงค์สำเร็จ -> เปลี่ยน Pop-up เป็นสีเขียวชวนสบายใจ
            await Swal.fire({
                title: 'ซิงค์ข้อมูลสำเร็จ!',
                text: 'ระบบได้อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว',
                icon: 'success',
                timer: 2000, // ปิดเองใน 2 วินาที
                showConfirmButton: false
            });

            setTimeout(() => inputRef.current?.focus(), 100);

        } catch (err: any) {
            // 4. ซิงค์พัง -> เปลี่ยน Pop-up เป็นสีแดงแจ้งเตือน
            await Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: err.message || 'ไม่สามารถซิงค์ข้อมูลได้',
                icon: 'error',
                confirmButtonText: 'รับทราบ'
            });
        }
    };

    // 🟩 ส่วนของ useEffect จะเหลือคลีน ๆ แค่นี้เลย
    useEffect(() => {
        if (shopeeMode === 'skunotfound') {
            import('sweetalert2').then((Swal) => {

                const productListHtml = `
                <p style="
                    font-size: 12px;
                    color: #9ca3af;
                    margin-bottom: 10px;
                    text-align: left;
                ">ต้องการอัพเดตฐานข้อมูลในเครื่อง?</p>

                <div style="
                    text-align: left;
                    max-height: 180px;
                    overflow-y: auto;
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 10px 12px;
                ">
                    <ul style="margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 6px;">
                    ${invalidProducts.map(p => `
                        <li style="font-size: 13px; color: #374151;">
                        <span style="font-weight: 600;">${p.sku || 'UndefinedSKU'}</span>
                        <span style="color: #9ca3af; font-size: 11px; margin-left: 6px; font-family: monospace;">
                            Barcode: ${p.barcode || 'ไม่มี'}
                        </span>
                        </li>
                    `).join('')}
                    </ul>
                </div>
                `;

                Swal.default.fire({
                    title: 'ไม่พบ SKU ในระบบ Shopee',
                    html: productListHtml,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'ตกลง',
                    cancelButtonText: 'ยกเลิก',
                }).then((result) => {
                    if (result.isConfirmed) {
                        // เรียกฟังก์ชันซิงค์ที่มี Loading สวย ๆ ด้านบน
                        handleSync();
                    }
                    setInvalidProducts([]);
                    setTimeout(() => inputRef.current?.focus(), 100);
                    setShopeeMode('search');
                });
            });
        }
    }, [shopeeMode]);

    const handleSearch = async () => {
        const q = query.trim();
        if (!q) return;
        setIsLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch('/shopeeq', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
                body: JSON.stringify({ q }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }
            const data: ShopeeOrder = await res.json();
            const invalid = data.products.filter(p => p.barcode === null || p.barcode === undefined);
            if (invalid.length !== 0) {
                setInvalidProducts(invalid);
                setShopeeMode('skunotfound');
            } else {
                onOrderFound(data); // ← ส่งขึ้น Parent
                setQuery('');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProductScan = useCallback((barcode: string) => {
        if (!orderData) return;
        setUnknownBarcode('');

        const target = orderData.products.find(p => p.barcode === barcode);
        if (!target || !target.barcode) {
            setUnknownBarcode(barcode);
            setFlashKey(k => k + 1);
            return;
        }

        const current = scanCounts[target.barcode] ?? 0;
        if (current >= target.quantity) {
            setFlashKey(k => k + 1);
            return;
        }

        const next = current + 1;
        const nextCounts = { ...scanCounts, [target.barcode]: next };
        setScanCounts(nextCounts);

        // ตรวจสอบว่าแพ็คครบทุกชิ้นหรือยัง
        const allDone = orderData.products.every(p =>
            !p.barcode || (nextCounts[p.barcode] ?? 0) >= p.quantity
        );

        if (allDone) {
            // ดึง SweetAlert2 มาใช้งานแบบ Dynamic หรือ Import ไว้ด้านบนก็ได้
            import('sweetalert2').then(async (Swal) => {
                // 1. แสดง Loading รอระหว่างยิง API
                Swal.default.fire({
                    title: 'กำลังบันทึกข้อมูล...',
                    text: `กำลังอัปเดตสถานะออเดอร์ ${orderData.order_sn}`,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    didOpen: () => {
                        Swal.default.showLoading();
                    }
                });

                try {
                    // 2. ยิง HTTP POST ไปที่ Controller (ส่งไปทั้งคู่กันเหนียว)
                    const response = await axios.post('/set-packed', {
                        order_sn: orderData.order_sn,
                        tracking_number: orderData.tracking_number
                    });

                    // เช็ก Response จาก Laravel/GAS
                    if (response.data?.status === 'success' || response.status === 200) {
                        // 3. แจ้งเตือนสำเร็จ
                        await Swal.default.fire({
                            icon: 'success',
                            title: 'แพ็คครบเรียบร้อย!',
                            text: 'ระบบได้บันทึกสถานะลง Google Sheet แล้ว',
                            timer: 2000,
                            showConfirmButton: false
                        });

                        // 4. รีเซ็ตหน้าจอกลับไปค้นหา
                        resetToSearch();
                    } else {
                        throw new Error(response.data?.message || 'GAS ตอบกลับมาแบบมี Error');
                    }

                } catch (error: any) {
                    console.error(error);
                    // 5. แจ้งเตือนเมื่อเกิดข้อผิดพลาด
                    Swal.default.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด!',
                        text: error.response?.data?.message || error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
                        confirmButtonText: 'รับทราบ',
                        confirmButtonColor: '#ee4d2d'
                    });
                }
            });
        }
    }, [orderData, scanCounts, resetToSearch]);

     const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = e.currentTarget.value.trim();
        if (!val) return;
        handleSearch();
    };

    const remaining = orderData
        ? orderData.products.reduce((acc, p) => acc + Math.max(0, p.quantity - (p.barcode ? (scanCounts[p.barcode] ?? 0) : 0)), 0)
        : 0;

    return (
        <div className="w-full flex flex-col gap-3">
            <ScannerStatusBar isFocused={isFocused} mode={shopeeMode} />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="text-gray-400 block mb-2">ค้นหาออเดอร์</label>
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="สแกน / พิมพ์ Tracking หรือ Order SN..."
                        autoComplete="off"
                        disabled={isLoading}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/10 transition-all placeholder:text-gray-300 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading || !query.trim()}
                        className="bg-[#ee4d2d] hover:bg-[#d73f21] disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                        ) : (
                            <ScanLine className="w-4 h-4" />
                        )}
                        ค้นหา
                    </button>
                </div>
                {errorMsg && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {errorMsg}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function Packing() {
    const [platform, setPlatform] = useState<Platform>('tiktok');
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [shopeeOrder, setShopeeOrder] = useState<ShopeeOrder | null>(null); // เพิ่ม

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        fetch('/get-packing-orders')
            .then(res => res.json())
            .then(data => {
                const validOrders = data.data?.filter((item: any) => item['Order ID']) || [];
                setOrders(validOrders);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' } // ใช้กล้องหลังดีกว่าสำหรับ scan
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error('ไม่สามารถเปิดกล้องได้:', err);
            }
        };
        const stopCamera = () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };

        if (selectedOrderId || shopeeOrder) startCamera(); // ← เพิ่ม shopeeOrder
        else stopCamera();

        return () => stopCamera();
    }, [selectedOrderId, shopeeOrder]); // ← เพิ่ม dependency

    if (shopeeOrder) {
        return (
            <div className="bg-[#eef1f8] min-h-full">
                <ShopeeVerifyPage
                    orderData={shopeeOrder}
                    onBack={() => setShopeeOrder(null)}
                    videoRef={videoRef}  // ← pass ลงไป
                />
            </div>
        );
    }

    // ─── TikTok: Camera View ───
    if (selectedOrderId) {
        const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);
        return (
            <div className="p-8 bg-white min-h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="flex flex-col">
                        <div className="bg-[#d9d9d9] aspect-[4/3] w-full relative flex items-center justify-center">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover absolute inset-0" />
                            {!streamRef.current && <span className="text-gray-500 font-medium">กำลังเปิดกล้อง...</span>}
                        </div>
                        <button onClick={() => setSelectedOrderId(null)} className="mt-6 text-gray-500 hover:text-gray-800 transition-colors w-fit">
                            <ArrowLeft className="w-10 h-10" />
                        </button>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">หมายเลข order : {selectedOrderId}</h3>
                        <div className="w-full mb-10">
                            <div className="grid grid-cols-4 bg-[#e2e2e2] text-gray-800 font-semibold py-2 px-2 border-b border-gray-400">
                                <div className="col-span-3">สินค้า</div>
                                <div className="text-right">จำนวน</div>
                            </div>
                            {currentOrderItems.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-4 items-center py-3 px-2 border-b border-gray-300 text-gray-700">
                                    <div className="col-span-3 pr-4 truncate" title={item['Product Name']}>{item['Product Name']}</div>
                                    <div className="text-right font-medium">0/{item['Quantity']}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setSelectedOrderId(null)} className="bg-[#cc0000] hover:bg-red-700 text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors">ยกเลิก</button>
                            <button onClick={() => alert('เตรียมทำระบบบันทึกต่อไป!')} className="bg-[#2b3e52] hover:bg-[#1e2d3d] text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors">บันทึก</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    } else if (orders){

    }

    // ─── Main Table View ───
    const uniqueOrders = Array.from(new Set(orders.map(o => o['Order ID'])));
    const totalPages = Math.ceil(uniqueOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = uniqueOrders.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="p-8 bg-[#eef1f8] min-h-full flex flex-col gap-6">

            {/* Platform Selector */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="flex bg-gray-100 p-1.5 rounded-xl w-fit gap-1">
                    <button
                        onClick={() => { setPlatform('tiktok'); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                            platform === 'tiktok'
                                ? 'bg-[#2b3e52] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                        }`}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        TikTok Shop
                    </button>
                    <button
                        onClick={() => { setPlatform('shopee'); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                            platform === 'shopee'
                                ? 'bg-[#ee4d2d] text-white shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                        }`}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Shopee
                    </button>
                </div>

                {platform === 'tiktok' && (
                    <div className="flex items-center gap-3">
                        <label className="text-gray-600 font-medium text-sm">แสดงหน้าละ :</label>
                        <select
                            className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-700 text-sm outline-none focus:border-blue-500 shadow-sm"
                            value={itemsPerPage}
                            onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        >
                            <option value={10}>10</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Platform Content */}
            {platform === 'shopee' ? (
                <ShopeePanel onOrderFound={(order) => setShopeeOrder(order)} />
            ) : (
                <div className="w-full bg-white shadow-sm rounded-lg overflow-hidden flex flex-col">
                    <div className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 bg-[#e2e2e2] text-gray-800 font-semibold py-4 px-8 border-b border-gray-300">
                        <div>หมายเลขคำสั่งซื้อ</div>
                        <div>สินค้า</div>
                        <div className="text-center">จำนวน</div>
                        <div className="text-right">สถานะ</div>
                    </div>

                    <div className="bg-white flex-1">
                        {loading ? (
                            <div className="text-center py-10 text-gray-500">กำลังดึงข้อมูล...</div>
                        ) : uniqueOrders.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">ไม่พบข้อมูลคำสั่งซื้อ</div>
                        ) : (
                            currentData.map((uniqueId: any, index) => {
                                const orderInfo = orders.find(o => o['Order ID'] === uniqueId);
                                const totalQty = orders.filter(o => o['Order ID'] === uniqueId).reduce((sum, item) => sum + Number(item['Quantity']), 0);
                                const hasMoreItems = orders.filter(o => o['Order ID'] === uniqueId).length > 1;
                                return (
                                    <div key={index} className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 items-center py-4 px-8 border-b border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">
                                        <div className="truncate" title={orderInfo['Order ID']}>{orderInfo['Order ID']}</div>
                                        <div className="truncate font-medium text-gray-700" title={orderInfo['Product Name']}>
                                            {orderInfo['Product Name']} {hasMoreItems ? '(และสินค้าอื่นๆ)' : ''}
                                        </div>
                                        <div className="text-center text-base font-bold text-blue-600">{totalQty}</div>
                                        <div className="text-right flex justify-end">
                                            {orderInfo['IsPacked'] == 0 ? (
                                                <button
                                                    className="bg-[#eab308] hover:bg-[#ca9a04] text-white px-6 py-2 rounded font-medium shadow transition-colors"
                                                    onClick={() => setSelectedOrderId(orderInfo['Order ID'])}
                                                >
                                                    เริ่มทำงาน
                                                </button>
                                            ) : (
                                                <span className="text-green-600 font-bold px-6 py-2 bg-green-50 rounded">แพ็คเสร็จแล้ว</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {!loading && uniqueOrders.length > 0 && (
                        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-8 py-4">
                            <div className="text-sm text-gray-600">
                                แสดง {startIndex + 1} ถึง {Math.min(startIndex + itemsPerPage, uniqueOrders.length)} จากทั้งหมด {uniqueOrders.length} รายการ
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-2 rounded flex items-center transition-colors ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`}
                                >
                                    <ChevronLeft className="w-5 h-5 mr-1" /> ก่อนหน้า
                                </button>
                                <span className="text-gray-700 font-medium px-4">หน้า {currentPage} / {totalPages || 1}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className={`px-3 py-2 rounded flex items-center transition-colors ${currentPage === totalPages || totalPages === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`}
                                >
                                    ถัดไป <ChevronRight className="w-5 h-5 ml-1" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ShopeeVerifyPage({
    orderData,
    onBack,
    videoRef,
}: {
    orderData: ShopeeOrder;
    onBack: () => void;
    videoRef: React.RefObject<HTMLVideoElement>; // ← เพิ่ม
}) {
    const [scanCounts, setScanCounts] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        orderData.products.forEach(p => { if (p.barcode) init[p.barcode] = 0; });
        return init;
    });
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [unknownBarcode, setUnknownBarcode] = useState('');
    const [flashKey, setFlashKey] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // ESC ย้อนกลับ
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onBack();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onBack]);

    const totalQuantity = orderData.products.reduce((acc, p) => acc + p.quantity, 0);

    const remaining = orderData.products.reduce(
        (acc, p) => acc + Math.max(0, p.quantity - (p.barcode ? (scanCounts[p.barcode] ?? 0) : 0)), 0
    );

    const packedQuantity = totalQuantity - remaining;

    const handleProductScan = useCallback((barcode: string) => {
        setUnknownBarcode('');
        const target = orderData.products.find(p => p.barcode === barcode);
        if (!target?.barcode) {
            setUnknownBarcode(barcode);
            setFlashKey(k => k + 1);
            return;
        }
        const current = scanCounts[target.barcode] ?? 0;
        if (current >= target.quantity) { setFlashKey(k => k + 1); return; }

        const nextCounts = { ...scanCounts, [target.barcode]: current + 1 };
        setScanCounts(nextCounts);

        const allDone = orderData.products.every(p =>
            !p.barcode || (nextCounts[p.barcode] ?? 0) >= p.quantity
        );
        if (allDone) {
            import('sweetalert2').then(async (Swal) => {
                Swal.default.fire({
                    title: 'กำลังบันทึกข้อมูล...',
                    text: `กำลังอัปเดตสถานะออเดอร์ ${orderData.order_sn}`,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    didOpen: () => Swal.default.showLoading()
                });
                try {
                    const response = await axios.post('/set-packed', {
                        order_sn: orderData.order_sn,
                        tracking_number: orderData.tracking_number
                    });
                    if (response.data?.status === 'success' || response.status === 200) {
                        await Swal.default.fire({
                            icon: 'success',
                            title: 'แพ็คครบเรียบร้อย!',
                            text: 'ระบบได้บันทึกสถานะลง Google Sheet แล้ว',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        onBack(); // ← กลับไป Parent
                    } else {
                        throw new Error(response.data?.message || 'GAS ตอบกลับมาแบบมี Error');
                    }
                } catch (error: any) {
                    Swal.default.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด!',
                        text: error.response?.data?.message || error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
                        confirmButtonText: 'รับทราบ',
                        confirmButtonColor: '#ee4d2d'
                    });
                }
            });
        }
    }, [orderData, scanCounts, onBack]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = e.currentTarget.value.trim();
        if (!val) return;
        handleProductScan(val);
        setQuery('');
    };

    const cameraWidth = "w-[380px]"; // ปรับขนาดความกว้างของกล้องตรงนี้ได้ตามใจชอบ (adjustable)

    return (
        <div className="flex flex-col gap-4 w-full max-w-7xl mx-auto p-4">
            {/* Top Section: Back Button & Status Bar */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center p-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:text-gray-900 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 ease-in-out"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <ScannerStatusBar isFocused={isFocused} mode="verify" />
                </div>
            </div>

            {/* Main Content Split Layout: กล้องซ้าย | ข้อมูลและรายการขวา */}
            <div className="flex flex-col lg:flex-row gap-5 items-start w-full">

                {/* ฝั่งซ้าย: Camera Preview Component (Adjustable Width) */}
                <div className={`flex-shrink-0 bg-black rounded-xl overflow-hidden aspect-[4/3] relative shadow-sm transition-all duration-300 ${cameraWidth}`}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                    {/* Scan crosshair overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border-2 border-white/70 rounded-lg relative">
                            {/* Corner brackets */}
                            <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#ee4d2d] rounded-tl-sm" />
                            <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#ee4d2d] rounded-tr-sm" />
                            <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#ee4d2d] rounded-bl-sm" />
                            <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#ee4d2d] rounded-br-sm" />
                        </div>
                    </div>
                </div>

                {/* ฝั่งขวา: Order Details, Scan Input, and Product List */}
                <div className="flex-1 w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">

                    {/* Order Header Info */}
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <p className="text-lg font-bold text-gray-900">{orderData.tracking_number}</p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">Order SN: {orderData.order_sn}</p>

                            {orderData.is_packed ? (
                                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                                    <Package size={13} /> แพ็คแล้ว
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                                    <ClockIcon size={13} /> ยังไม่แพ็ค
                                </span>
                            )}
                        </div>

                        {/* สัดส่วนการแพ็ค x/y */}
                        <div className="text-right flex-shrink-0 text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                            {packedQuantity} / {totalQuantity}
                        </div>
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* Scan Input Section */}
                    <div>
                        <label className="text-gray-500 text-xs font-medium block mb-1.5">สแกนสินค้า</label>
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder="สแกน barcode สินค้า..."
                                autoComplete="off"
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/10 transition-all placeholder:text-gray-300"
                            />
                            <button
                                onClick={onBack}
                                className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                            >
                                ยกเลิก
                            </button>
                        </div>

                        {unknownBarcode && (
                            <div key={flashKey} className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                ไม่พบ barcode <span className="font-mono font-semibold">{unknownBarcode}</span> ในออเดอร์นี้
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* Product List Section */}
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                        {orderData.products.map(p => (
                            <ProductVerifyRow
                                key={p.barcode ?? p.sku}
                                product={p}
                                scanned={p.barcode ? (scanCounts[p.barcode] ?? 0) : 0}
                            />
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
