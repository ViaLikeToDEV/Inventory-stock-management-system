import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag, ScanLine, CheckCircle2, AlertCircle, Package, Clock as ClockIcon} from 'lucide-react';
import axios from 'axios';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Platform = 'tiktok' | 'shopee';
type ShopeeMode = 'search' | 'verify';

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
function ShopeePanel() {
    const [shopeeMode, setShopeeMode] = useState<ShopeeMode>('search');
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [orderData, setOrderData] = useState<ShopeeOrder | null>(null);
    const [scanCounts, setScanCounts] = useState<Record<string, number>>({});
    const [unknownBarcode, setUnknownBarcode] = useState('');
    const [flashKey, setFlashKey] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Re-focus after mode switch
    useEffect(() => {
        if (shopeeMode === 'verify') {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [shopeeMode]);

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
                // ดึง json error ที่ส่งมาจาก Controller
                const errorData = await res.json();
                // ถ้ามี message ส่งมาให้ใช้ message นั้น ถ้าไม่มีค่อยใช้คำกลางๆ
                throw new Error(errorData.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }
            const data: ShopeeOrder = await res.json();

            const initialCounts: Record<string, number> = {};
            data.products.forEach(p => {
                if (p.barcode) initialCounts[p.barcode] = 0;
            });
            setScanCounts(initialCounts);
            setOrderData(data);
            setShopeeMode('verify');
            setQuery('');
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
        const val = (e.currentTarget as HTMLInputElement).value.trim();
        if (!val) return;

        if (shopeeMode === 'search') {
            handleSearch();
        } else {
            handleProductScan(val);
            setQuery('');
        }
    };

    const remaining = orderData
        ? orderData.products.reduce((acc, p) => acc + Math.max(0, p.quantity - (p.barcode ? (scanCounts[p.barcode] ?? 0) : 0)), 0)
        : 0;

    return (
        <div className="w-full flex flex-col gap-3">
            {/* Status Bar */}
            <ScannerStatusBar isFocused={isFocused} mode={shopeeMode} />

            {/* Search Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <label className="text-gray-400 block mb-2">
                    {shopeeMode === 'search' ? 'ค้นหาออเดอร์' : 'สแกนสินค้า'}
                </label>
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={
                            shopeeMode === 'search'
                                ? 'สแกน / พิมพ์ Tracking หรือ Order SN...'
                                : 'สแกน barcode สินค้า...'
                        }
                        autoComplete="off"
                        disabled={isLoading}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/10 transition-all placeholder:text-gray-300 disabled:opacity-50"
                    />
                    {shopeeMode === 'search' && (
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
                    )}
                    {shopeeMode === 'verify' && (
                        <button
                            onClick={resetToSearch}
                            className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors flex-shrink-0"
                        >
                            ยกเลิก
                        </button>
                    )}
                </div>

                {/* Error */}
                {errorMsg && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {errorMsg}
                    </div>
                )}

                {/* Unknown barcode */}
                {unknownBarcode && shopeeMode === 'verify' && (
                    <div key={flashKey} className="mt-2.5 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        ไม่พบ barcode <span className="font-mono font-semibold">{unknownBarcode}</span> ในออเดอร์นี้
                    </div>
                )}
            </div>

            {/* Order Card (Verify Mode) */}
            {orderData && shopeeMode === 'verify' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    {/* Order Header */}
                    <div className="flex flex-col mb-4 gap-2">
                        <div>
                            <p className="text-lg font-bold text-gray-900">{orderData.tracking_number}</p>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">Order SN: {orderData.order_sn}</p>

                            {/* Status tag — sits directly under tracking number as visual anchor */}
                            {orderData.is_packed ? (
                            <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                                <Package size={13} />
                                แพ็คแล้ว
                            </span>
                            ) : (
                            <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                                <ClockIcon size={13} />
                                ยังไม่แพ็ค
                            </span>
                            )}
                        </div>
                        </div>

                    <div className="h-px bg-gray-100 mb-4" />

                    {/* Product List */}
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                        สินค้าในออเดอร์ — เหลืออีก {remaining} ชิ้น
                    </p>
                    <div className="flex flex-col gap-2">
                        {orderData.products.map(p => (
                            <ProductVerifyRow
                                key={p.barcode ?? p.sku}
                                product={p}
                                scanned={p.barcode ? (scanCounts[p.barcode] ?? 0) : 0}
                            />
                        ))}
                    </div>

                    {/* Hint */}
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5">
                        <ScanLine className="w-3.5 h-3.5 flex-shrink-0" />
                        {remaining > 0
                            ? `สแกน barcode สินค้าทีละชิ้น — เหลืออีก ${remaining} ชิ้น`
                            : 'ครบทุกชิ้นแล้ว!'}
                    </div>
                </div>
            )}
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
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
        if (selectedOrderId) startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [selectedOrderId]);

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
                <ShopeePanel />
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
