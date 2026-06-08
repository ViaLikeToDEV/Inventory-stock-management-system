import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag, ScanLine, CheckCircle2, AlertCircle, Package, Clock as ClockIcon, Video, VideoOff, Circle, UploadCloud, Folder} from 'lucide-react';
import axios from 'axios';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Platform = 'tiktok' | 'shopee';
type ShopeeMode = 'search' | 'skunotfound';

type UploadState = {
    status: 'uploading' | 'success' | 'error';
    progress: number;
    blob: Blob;
    fileName: string;
};

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

interface ShopeePanelProps {
    onOrderFound: (order: any) => void;
    saveDirectoryHandle: any; // 👈 เพิ่มบรรทัดนี้ (หรือเปลี่ยน any เป็น FileSystemDirectoryHandle ถ้าอยากได้ Type แม่นๆ)
}

// ─────────────────────────────────────────────
// Sub-component: Status Bar
// ─────────────────────────────────────────────
function ScannerStatusBar({ isFocused, mode }: { isFocused: boolean; mode: ShopeeMode | 'verify' }) {
    const label = mode === 'search'
        ? (isFocused ? 'พร้อมรับบาร์โค้ด — สแกนหรือพิมพ์ได้เลย' : 'คลิกที่ช่องค้นหาเพื่อเริ่มสแกน')
        : (isFocused ? 'พร้อมสแกนสินค้า — วาง barcode ที่ scanner' : 'กล่องรับสแกนไม่มี focus — คลิกที่ช่องก่อน');

    const modeTag = mode === 'search' ? 'SEARCH MODE' : 'VERIFY MODE';

    return (
        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isFocused ? (mode === 'search' ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' : 'bg-blue-50 border border-blue-300 text-blue-800') : 'bg-gray-100 border border-gray-200 text-gray-500'}`}>
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                {isFocused && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${mode === 'search' ? 'bg-emerald-400' : 'bg-blue-400'}`} />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isFocused ? (mode === 'search' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-gray-400'}`} />
            </span>
            <ScanLine className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md ${isFocused ? (mode === 'search' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700') : 'bg-gray-200 text-gray-500'}`}>
                {modeTag}
            </span>
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-component: Product Row (Verify Mode)
// ─────────────────────────────────────────────
function ProductVerifyRow({ product, scanned }: { product: ShopeeProduct | any; scanned: number }) {
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

// ─────────────────────────────────────────────
// Sub-component: Shopee Panel
// ─────────────────────────────────────────────
function ShopeePanel({ onOrderFound, saveDirectoryHandle }: ShopeePanelProps) {
    const [shopeeMode, setShopeeMode] = useState<ShopeeMode>('search');
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [invalidProducts, setInvalidProducts] = useState<ShopeeProduct[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSync = async () => {
        const Swal = (await import('sweetalert2')).default;
        Swal.fire({ title: 'กำลังซิงค์ข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            await axios.post(route('sync-products'));
            await Swal.fire({ title: 'ซิงค์ข้อมูลสำเร็จ!', icon: 'success', timer: 2000, showConfirmButton: false });
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (err: any) {
            await Swal.fire({ title: 'เกิดข้อผิดพลาด', text: err.message, icon: 'error' });
        }
    };

    useEffect(() => {
        if (shopeeMode === 'skunotfound') {
            import('sweetalert2').then((Swal) => {
                const productListHtml = `<div style="text-align: left; max-height: 180px; overflow-y: auto;">...</div>`;
                Swal.default.fire({
                    title: 'ไม่พบ SKU ในระบบ Shopee',
                    html: productListHtml,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'อัปเดตฐานข้อมูล'
                }).then((result) => {
                    if (result.isConfirmed) handleSync();
                    setInvalidProducts([]);
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
            const response = await axios.post<ShopeeOrder>(route('shopee-query'), { q });
            const data = response.data;
            const invalid = data.products.filter(p => !p.barcode);
            if (invalid.length !== 0) {
                setInvalidProducts(invalid);
                setShopeeMode('skunotfound');
            } else {
                onOrderFound(data);
                setQuery('');
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || 'เกิดข้อผิดพลาด';
            const raw = err.response?.data?.raw || '(ไม่มี raw)';
            const status = err.response?.status || '(ไม่มี status)';
            setErrorMsg(`[${status}] ${msg} | raw: ${raw}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
    };

    const isSearchDisabled = !saveDirectoryHandle || isLoading;

    return (
        <div className="w-full flex flex-col gap-3">
        <ScannerStatusBar isFocused={isFocused} mode={shopeeMode} />

        {/* เพิ่ม relative เข้าไปที่กล่อง เพื่อให้ overlay ทำงานได้ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 relative overflow-hidden">

            {/* 🔒 OVERLAY: ถ้าไม่มี handle จะขึ้นม่านกระจกบังและล็อกไม่ให้กดอะไรได้เลย */}
            {!saveDirectoryHandle && (
                <div className="absolute inset-0 bg-gray-50/60 backdrop-blur-[1px] z-10 flex items-center justify-center border border-dashed border-gray-300 rounded-xl">
                    <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1.5 rounded-md shadow-sm border border-gray-100">
                        ⚠️ กรุณาเลือกโฟลเดอร์สำหรับบันทึกไฟล์ก่อนค้นหา
                    </span>
                </div>
            )}

            <label className={`block mb-2 text-sm font-medium ${!saveDirectoryHandle ? 'text-gray-300' : 'text-gray-500'}`}>
                ค้นหาออเดอร์ (Shopee)
            </label>

            <div className="flex gap-2">
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={isSearchDisabled ? undefined : handleKeyDown} // ล็อกปุ่ม Enter บนคีย์บอร์ด
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={isSearchDisabled} // ล็อก input
                    placeholder={saveDirectoryHandle ? "สแกน / พิมพ์ Tracking หรือ Order SN..." : "ยังไม่ได้เลือกโฟลเดอร์..."}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#ee4d2d] disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                <button
                    onClick={handleSearch}
                    disabled={isSearchDisabled || !query.trim()} // ล็อกปุ่มกด
                    className="bg-[#ee4d2d] hover:bg-[#d73f21] disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0 disabled:cursor-not-allowed"
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
            {errorMsg && <div className="mt-2.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{errorMsg}</div>}
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
    const [shopeeOrder, setShopeeOrder] = useState<ShopeeOrder | null>(null);

    // 🟢 TT Search & Scan States
    const [barcodeDB, setBarcodeDB] = useState<Record<string, string>>({});
    const [ttSearchQuery, setTtSearchQuery] = useState('');
    const [ttScanQuery, setTtScanQuery] = useState('');
    const [ttScanCounts, setTtScanCounts] = useState<Record<string, number>>({});
    const [ttUnknownBarcode, setTtUnknownBarcode] = useState('');
    const [ttIsScanFocused, setTtIsScanFocused] = useState(false);
    const ttInputRef = useRef<HTMLInputElement>(null);
    const ttScanInputRef = useRef<HTMLInputElement>(null);

    // 🟢 Video Recording States (For both TT and Shopee)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [saveDirectoryHandle, setSaveDirectoryHandle] = useState<any>(null);
    const [uploadQueue, setUploadQueue] = useState<Record<string, UploadState>>({});

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        fetch('/get-packing-orders')
            .then(res => res.json())
            .then(data => {
                const validOrders = data.data?.filter((item: any) => item['Order ID']) || [];
                setOrders(validOrders);
                if (data.products) setBarcodeDB(data.products);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) { console.error('ไม่สามารถเปิดกล้องได้:', err); }
        };
        const stopCamera = () => {
            stopRecording(false);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };

        if (selectedOrderId || shopeeOrder) startCamera();
        else stopCamera();

        return () => stopCamera();
    }, [selectedOrderId, shopeeOrder]);

    useEffect(() => {
        if (selectedOrderId) {
            setTtScanCounts({});
            setTtUnknownBarcode('');
            setTtScanQuery('');
            setTimeout(() => ttScanInputRef.current?.focus(), 100);
        }
    }, [selectedOrderId]);

    const handleTtSearch = async () => {
        const query = ttSearchQuery.trim();
        if (!query) return;
        const found = orders.find(o => o['Order ID'] === query || o['Tracking Number'] === query);
        if (found) {
            setSelectedOrderId(found['Order ID']);
            setTtSearchQuery('');
        } else {
            const Swal = (await import('sweetalert2')).default;
            Swal.fire({ icon: 'error', title: 'ไม่พบออเดอร์', text: `ไม่พบข้อมูลออเดอร์: ${query}` });
        }
    };

    const handleTtProductScan = (barcode: string) => {
        setTtUnknownBarcode('');
        const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);
        let matchedProductName = barcodeDB[barcode];
        let targetItem = matchedProductName
            ? currentOrderItems.find(item => String(item['Product Name']).includes(matchedProductName))
            : currentOrderItems.find(item => String(item['Barcode']) === barcode);

        if (!targetItem) {
            setTtUnknownBarcode(barcode);
            return;
        }

        const pName = targetItem['Product Name'];
        const currentQty = ttScanCounts[pName] || 0;
        const maxQty = Number(targetItem['Quantity']);
        if (currentQty >= maxQty) return;

        setTtScanCounts(prev => ({ ...prev, [pName]: currentQty + 1 }));
    };

    const getFileName = (orderId: string) => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${orderId}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.webm`;
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => res((reader.result as string).split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
        });
    };

    const uploadToGoogleDriveBackground = async (blob: Blob, fileName: string, orderId: string) => {
        try {
            const base64 = await blobToBase64(blob);
            // 🚨 URL ใหม่ที่คุณให้มา
            const response = await fetch("https://script.google.com/macros/s/AKfycby7pmxLZVsHwyDi_Btv3Qd1ANqV1Rd2Qr4W0YfhKfSJ6_SgCclXQV48nPCeDXXYSYtxuQ/exec", {
                method: "POST", mode: "cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ fileName, video: base64 })
            });
            const result = await response.json();
            if (result.status === 'success') {
                setUploadQueue(prev => ({ ...prev, [orderId]: { ...prev[orderId], status: 'success', progress: 100 } }));
            } else throw new Error("Upload response error");
        } catch (error) {
            setUploadQueue(prev => ({ ...prev, [orderId]: { ...prev[orderId], status: 'error' } }));
        }
    };

    const handleSelectDirectory = async () => {
        try {
            // @ts-ignore
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setSaveDirectoryHandle(dirHandle);

            // 📦 dynamic import เฉพาะตอนที่ฟังก์ชันนี้ทำงานสำเร็จ
            const { default: Swal } = await import('sweetalert2');

            Swal.fire({
                icon: 'success',
                title: 'เชื่อมต่อสำเร็จ',
                text: '✅ช่องค้นหาและแพ็คออเดอร์ปลดล็อคแล้ว',
                timer: 2000, // ⏱️ ปิดตัวเองภายใน 2000 มิลลิวินาที (2 วินาที)
                timerProgressBar: true, // ตัววิ่งด้านล่าง บอกเวลาถอยหลัง (ดูโปรขึ้นเยอะ)
                showConfirmButton: false, // ซ่อนปุ่มตกลงไปเลย เพราะมันจะปิดเองอยู่แล้ว
                customClass: {
                    popup: 'rounded-xl'
                }
            });

        } catch (error) {
            console.error('ยกเลิกการเลือกโฟลเดอร์:', error);
        }
    };

    const saveVideoLocally = async (blob: Blob, fileName: string) => {
        if (!saveDirectoryHandle) {
            alert('🚨 กรุณากดเลือกโฟลเดอร์บันทึกคลิป (ปุ่มบนตาราง) ก่อนเริ่มงานครับ!');
            return false;
        }
        try {
            const now = new Date();
            const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthDirHandle = await saveDirectoryHandle.getDirectoryHandle(yearMonth, { create: true });
            const fileHandle = await monthDirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการบันทึกไฟล์ลงคอมพิวเตอร์');
            return false;
        }
    };

    const startRecording = useCallback(() => {
        if (!streamRef.current) return;
        recordedChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingTime(0);
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    }, []); // แยกรันตาม refs ไม่ต้องมี dependency ตัวอื่น

    // ปรับให้รับ orderId เข้ามาโดยตรง เพื่อรองรับทั้ง TT และ Shopee
    const stopRecording = (saveFile: boolean, targetOrderId?: string) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            setIsRecording(false); return;
        }
        if (saveFile && targetOrderId) {
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const fileName = getFileName(targetOrderId);
                const localSaveSuccess = await saveVideoLocally(blob, fileName);

                if (localSaveSuccess) {
                    setUploadQueue(prev => ({ ...prev, [targetOrderId]: { status: 'uploading', progress: 0, blob, fileName } }));
                    uploadToGoogleDriveBackground(blob, fileName, targetOrderId);
                }
                recordedChunksRef.current = [];
            };
        } else {
            mediaRecorderRef.current.onstop = () => { recordedChunksRef.current = []; };
        }
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        setIsRecording(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleTtSave = () => {
        stopRecording(true, selectedOrderId!);
        setSelectedOrderId(null);
    };

    // ─── Shopee Verify View (UI เหมือน TikTok) ───
    if (shopeeOrder) {
        return (
            <div className="bg-[#eef1f8] min-h-full">
                <ShopeeVerifyPage
                    orderData={shopeeOrder}
                    onBack={() => setShopeeOrder(null)}
                    videoRef={videoRef}
                    isRecording={isRecording}
                    recordingTime={recordingTime}
                    formatTime={formatTime}
                    startRecording={startRecording}
                    stopRecording={(save) => stopRecording(save, shopeeOrder.order_sn)}
                />
            </div>
        );
    }

    // ─── TikTok Verify View (UI เหมือน Shopee เป๊ะ) ───
    if (selectedOrderId) {
        const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);
        const trackingNumber = currentOrderItems[0]?.['Tracking Number'] || selectedOrderId;
        const totalQuantity = currentOrderItems.reduce((sum, item) => sum + Number(item['Quantity']), 0);
        const packedQuantity = currentOrderItems.reduce((sum, item) => sum + (ttScanCounts[item['Product Name']] || 0), 0);
        const isAllDone = packedQuantity >= totalQuantity;

        return (
            <div className="flex flex-col gap-4 w-full max-w-7xl mx-auto p-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => { stopRecording(false); setSelectedOrderId(null); }} className="p-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:text-gray-900 transition-all"><ArrowLeft className="w-5 h-5" /></button>
                    <div className="flex-1"><ScannerStatusBar isFocused={ttIsScanFocused} mode="verify" /></div>
                </div>

                <div className="flex flex-col lg:flex-row gap-5 items-start w-full">
                    {/* ฝั่งซ้าย: กล้อง + ปุ่มวิดีโอ */}
                    <div className="flex flex-col gap-3 w-full lg:w-[380px] flex-shrink-0">
                        <div className="bg-black rounded-xl overflow-hidden aspect-[4/3] relative shadow-sm">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            {!streamRef.current && <span className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">กำลังเปิดกล้อง...</span>}
                            {/* กรอบสแกนสีแดง */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-40 h-40 border-2 border-white/70 rounded-lg relative">
                                    <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#ee4d2d] rounded-tl-sm" />
                                    <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#ee4d2d] rounded-tr-sm" />
                                    <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#ee4d2d] rounded-bl-sm" />
                                    <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#ee4d2d] rounded-br-sm" />
                                </div>
                            </div>
                            {/* ป้าย REC */}
                            {isRecording && (
                                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full z-10 text-white text-sm font-bold tracking-wider">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /> REC {formatTime(recordingTime)}
                                </div>
                            )}
                        </div>
                        {/* ปุ่มควบคุมวิดีโอ */}
                        <div className="flex gap-2 w-full">
                            {!isRecording ? (
                                <button onClick={startRecording} className="flex-1 flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm">
                                    <Video className="w-4 h-4" /> เริ่มบันทึกวิดีโอ
                                </button>
                            ) : (
                                <button onClick={() => stopRecording(false)} className="flex-1 flex justify-center items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors">
                                    <VideoOff className="w-4 h-4" /> ยกเลิกวิดีโอ
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ฝั่งขวา: รายละเอียด, ช่องสแกน, รายการสินค้า */}
                    <div className="flex-1 w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 min-w-0">
                        <div className="flex justify-between items-start w-full">
                            <div>
                                <p className="text-lg font-bold text-gray-900">{trackingNumber}</p>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">Order ID: {selectedOrderId}</p>
                                {isAllDone ? (
                                    <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-green-100 text-green-700"><Package size={13} /> แพ็คครบแล้ว</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700"><ClockIcon size={13} /> กำลังแพ็ค</span>
                                )}
                            </div>
                            <div className="text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">{packedQuantity} / {totalQuantity}</div>
                        </div>

                        <div className="h-px bg-gray-200" />

                        {/* ช่องสแกน TikTok */}
                        <div>
                            <label className="text-gray-500 text-xs font-medium block mb-1.5">สแกนสินค้าเพื่อเช็ค</label>
                            <div className="flex gap-2">
                                <input
                                    ref={ttScanInputRef} value={ttScanQuery} onChange={e => setTtScanQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { e.preventDefault(); if (ttScanQuery.trim()) { handleTtProductScan(ttScanQuery.trim()); setTtScanQuery(''); } }
                                    }}
                                    onFocus={() => setTtIsScanFocused(true)} onBlur={() => setTtIsScanFocused(false)}
                                    placeholder="สแกน barcode สินค้า..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2b3e52]"
                                />
                                <button onClick={() => { stopRecording(false); setSelectedOrderId(null); }} className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600 font-medium">ยกเลิก</button>
                            </div>
                            {ttUnknownBarcode && <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg animate-pulse"><AlertCircle className="w-3.5 h-3.5" /> ไม่พบ barcode <span className="font-mono">{ttUnknownBarcode}</span></div>}
                        </div>

                        <div className="h-px bg-gray-200" />

                        {/* รายการสินค้า TikTok */}
                        <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                            {currentOrderItems.map((item, idx) => {
                                const pName = item['Product Name'];
                                return <ProductVerifyRow key={idx} product={item} scanned={ttScanCounts[pName] || 0} />
                            })}
                        </div>

                        {/* ปุ่มบันทึก TikTok */}
                        <div className="mt-auto pt-4 flex gap-3">
                            <button onClick={handleTtSave} className="bg-[#1e2e40] hover:bg-[#0f172a] text-white font-bold py-3 px-6 rounded-xl transition-colors flex-1 shadow-sm text-sm">
                                บันทึกและอัปโหลดวิดีโอ (TT)
                            </button>
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
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="flex bg-gray-100 p-1.5 rounded-xl w-fit gap-1">
                    <button onClick={() => { setPlatform('tiktok'); setCurrentPage(1); }} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${platform === 'tiktok' ? 'bg-[#2b3e52] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
                        <ShoppingBag className="w-4 h-4" /> TikTok Shop
                    </button>
                    <button onClick={() => { setPlatform('shopee'); setCurrentPage(1); }} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${platform === 'shopee' ? 'bg-[#ee4d2d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
                        <ShoppingBag className="w-4 h-4" /> Shopee
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSelectDirectory}
                        className={`px-4 py-2 rounded-lg shadow-sm transition-all text-sm flex items-center gap-2 font-medium ${
                            saveDirectoryHandle
                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        {saveDirectoryHandle ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span>เชื่อมต่อแล้ว</span>
                            </>
                        ) : (
                            <>
                                <Folder className="w-4 h-4" />
                                <span>แฟ้มบันทึกวิดีโอ</span>
                            </>
                        )}
                    </button>
                    {platform === 'tiktok' && (
                        <div className="flex items-center gap-3 border-l pl-4 border-gray-200">
                            <label className="text-gray-500 font-medium text-sm">หน้าละ :</label>
                            <select className="bg-transparent text-gray-800 font-bold outline-none cursor-pointer" value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                                <option value={10}>10</option><option value={30}>30</option><option value={50}>50</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {platform === 'shopee' ? (
                <ShopeePanel
                    onOrderFound={(order) => setShopeeOrder(order)}
                    saveDirectoryHandle={saveDirectoryHandle} // 👈 ส่ง State นี้เข้าไปด้วย
                />
            ) : (
                <div className="flex flex-col gap-4 w-full">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <label className="text-gray-400 block mb-2 font-medium">ค้นหาออเดอร์ (TikTok)</label>
                        <div className="flex gap-2">
                            <input
                                ref={ttInputRef} value={ttSearchQuery} onChange={e => setTtSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTtSearch()}
                                placeholder="สแกน / พิมพ์ หมายเลขคำสั่งซื้อ หรือ Tracking..."
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2b3e52]"
                            />
                            <button onClick={handleTtSearch} className="bg-[#2b3e52] hover:bg-[#1e2d3d] text-white px-5 py-2.5 rounded-lg text-sm flex items-center gap-1.5 font-medium">
                                <ScanLine className="w-4 h-4" /> ค้นหา
                            </button>
                        </div>
                    </div>
                    <div className="w-full bg-white shadow-sm rounded-xl overflow-hidden flex flex-col border border-gray-200">
                        <div className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 bg-[#f8fafc] text-gray-600 font-bold py-4 px-8 border-b border-gray-200 text-sm uppercase tracking-wider">
                            <div>หมายเลขคำสั่งซื้อ</div>
                            <div>สินค้า</div>
                            <div className="text-center">จำนวน</div>
                            <div className="text-right">สถานะ</div>
                        </div>
                        <div className="bg-white flex-1">
                            {loading ? <div className="text-center py-10 text-gray-500">กำลังดึงข้อมูล...</div> : uniqueOrders.length === 0 ? <div className="text-center py-10 text-gray-500">ไม่พบข้อมูลคำสั่งซื้อ</div> : (
                                currentData.map((uniqueId: any, index) => {
                                    const orderInfo = orders.find(o => o['Order ID'] === uniqueId);
                                    const totalQty = orders.filter(o => o['Order ID'] === uniqueId).reduce((sum, item) => sum + Number(item['Quantity']), 0);
                                    const qItem = uploadQueue[uniqueId];

                                    return (
                                        <div key={index} className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 items-center py-4 px-8 border-b border-gray-100 text-gray-600 hover:bg-gray-50 transition">
                                            <div className="truncate text-gray-900 font-medium">{orderInfo['Order ID']}</div>
                                            <div className="truncate">{orderInfo['Product Name']}</div>
                                            <div className="text-center font-bold text-blue-600">{totalQty}</div>
                                            <div className="text-right flex justify-end">
                                                {qItem?.status === 'uploading' ? (
                                                    <div className="w-32 flex flex-col items-end gap-2">
                                                        <span className="text-xs text-blue-600 font-bold flex items-center gap-1"><UploadCloud className="w-3 h-3 animate-bounce"/>กำลังอัปโหลด...</span>
                                                        <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden relative"><div className="absolute top-0 bottom-0 bg-blue-500 rounded-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] translate-x-full" /></div>
                                                    </div>
                                                ) : qItem?.status === 'error' ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> ล้มเหลว</span>
                                                        <button onClick={() => uploadToGoogleDriveBackground(qItem.blob, qItem.fileName, uniqueId as string)} className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-200">🔄 ลองใหม่</button>
                                                    </div>
                                                ) : orderInfo['IsPacked'] == 0 && qItem?.status !== 'success' ? (
                                                    <button className="bg-amber-400 hover:bg-amber-500 text-white px-6 py-2 rounded-full font-bold shadow-sm" onClick={() => setSelectedOrderId(orderInfo['Order ID'])}>เริ่มทำงาน</button>
                                                ) : (
                                                    <span className="text-emerald-600 font-bold px-4 py-1.5 bg-emerald-50 rounded-full text-sm">แพ็คเสร็จแล้ว ✅</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-component: Shopee Verify Page (UI Updated)
// ─────────────────────────────────────────────
function ShopeeVerifyPage({
    orderData, onBack, videoRef, isRecording, recordingTime, formatTime, startRecording, stopRecording
}: {
    orderData: ShopeeOrder; onBack: () => void; videoRef: React.RefObject<HTMLVideoElement>;
    isRecording: boolean; recordingTime: number; formatTime: (s: number) => string;
    startRecording: () => void; stopRecording: (save: boolean) => void;
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

    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onBack]);

    const IsPack = orderData.is_packed === 1;
    const totalQuantity = orderData.products.reduce((acc, p) => acc + p.quantity, 0);
    const remaining = orderData.products.reduce((acc, p) => acc + Math.max(0, p.quantity - (p.barcode ? (scanCounts[p.barcode] ?? 0) : 0)), 0);
    const packedQuantity = totalQuantity - remaining;
    const isAllDone = packedQuantity >= totalQuantity;

    const handleProductScan = useCallback((barcode: string) => {
        setUnknownBarcode('');
        const target = orderData.products.find(p => p.barcode === barcode);

        // Case 1: บาร์โค้ดมั่ว/ไม่มีในระบบ
        if (!target?.barcode) {
            setUnknownBarcode(barcode);
            setFlashKey(k => k + 1);
            return;
        }

        const current = scanCounts[target.barcode] ?? 0;

        // Case 2: สแกนเกินจำนวนที่สั่งซื้อ
        if (current >= target.quantity) {
            setFlashKey(k => k + 1);
            return;
        }

        // Case 3: สแกนผ่าน (Valid) -> เริ่มอัดวิดีโอ (ถ้ายังไม่ได้อัด) และเพิ่มยอด
        // เช็ค state จาก mediaRecorderRef หรือ isRecording (แนะนำใช้ ref เช็คจะชัวร์สุดในจังหวะ callback ซ้อนกัน)
        if (!isRecording) {
            startRecording();
        }

        setScanCounts({ ...scanCounts, [target.barcode]: current + 1 });

        // อย่าลืมเพิ่ม startRecording เข้าไปใน Dependency Array ด้วยล่ะ!
    }, [orderData, scanCounts, startRecording]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = e.currentTarget.value.trim();
        if (!val) return;
        handleProductScan(val);
        setQuery('');
    };

    const handleShopeeSave = async () => {
        // เช็กก่อนเลยว่าแพ็กครบหรือยัง ถ้ายังไม่ครบก็ไม่ต้องเดินหน้าต่อ
        if (packedQuantity !== totalQuantity) {
            import('sweetalert2').then((Swal) => {
                Swal.default.fire({
                    icon: 'warning',
                    title: 'แพ็กของยังไม่ครบ!',
                    text: `กรุณาแพ็กให้ครบจำนวนก่อนบันทึก (จำนวนที่แพ็ก: ${packedQuantity}/${totalQuantity})`,
                    confirmButtonText: 'ตกลง'
                });
            });
            return; // ตัดจบตรงนี้ ไม่รันโค้ดข้างล่างต่อ
        }

        // ให้บันทึกวิดีโอก่อน
        stopRecording(true);
        import('sweetalert2').then(async (Swal) => {
            Swal.default.fire({
                title: 'กำลังบันทึกข้อมูล...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.default.showLoading()
            });

            try {
                const response = await axios.post(route('shopee-setpacked'), {
                    order_sn: orderData.order_sn,
                    tracking_number: orderData.tracking_number
                });

                // ตรงนี้จะเข้าเฉพาะตระกูล Status HTTP 2xx (เช่น 200 OK คือแพ็คสำเร็จจริง)
                if (response.data?.status === 'success') {
                    await Swal.default.fire({
                        icon: 'success',
                        title: `${response.data?.message || 'สำเร็จ'}`,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    onBack(); // แพ็คสำเร็จจริงค่อยย้อนกลับ
                } else {
                    throw new Error(response.data?.message || 'เกิดข้อผิดพลาดในการบันทึก');
                }
            } catch (error: any) {
                // ดึง message ที่มาจาก Laravel (รวมถึงกรณีติด 400 'สินค้าชิ้นนี้ถูกแพ็คแล้ว')
                const errorMessage = error.response?.data?.message || error.message || 'ระบบขัดข้อง';
                const errorStatus = error.response?.data?.status || 'error';

                Swal.default.fire({
                    icon: errorStatus === 'warning' ? 'warning' : 'error',
                    title: 'ไม่สามารถบันทึกได้!',
                    text: errorMessage
                });
                // ไม่ใส่ onBack() ตรงนี้ เพื่อให้ User เห็นหน้าจอเดิมและรู้ว่าเกิดอะไรขึ้น
            }
        });
    };

    return (
        <div className="flex flex-col gap-4 w-full max-w-7xl mx-auto p-8">
            <div className="flex items-center gap-4">
                <button onClick={() => { stopRecording(false); onBack(); }} className="p-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:text-gray-900 transition-all"><ArrowLeft className="w-5 h-5" /></button>
                <div className="flex-1"><ScannerStatusBar isFocused={isFocused} mode="verify" /></div>
            </div>
            <div className="flex flex-col lg:flex-row gap-5 items-start w-full">

                {/* ฝั่งซ้าย: กล้อง + วิดีโอ (เหมือน TT เป๊ะ) */}
                <div className="flex flex-col gap-3 w-full lg:w-[380px] flex-shrink-0">
                    <div className="bg-black rounded-xl overflow-hidden aspect-[4/3] relative shadow-sm">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-40 h-40 border-2 border-white/70 rounded-lg relative">
                                <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#ee4d2d] rounded-tl-sm" />
                                <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#ee4d2d] rounded-tr-sm" />
                                <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#ee4d2d] rounded-bl-sm" />
                                <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#ee4d2d] rounded-br-sm" />
                            </div>
                        </div>
                        {isRecording && (
                            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full z-10 text-white text-sm font-bold tracking-wider">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /> REC {formatTime(recordingTime)}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 w-full">
                        {!isRecording ? (
                            <button onClick={startRecording} className="flex-1 flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-sm">
                                <Video className="w-4 h-4" /> เริ่มบันทึกวิดีโอ
                            </button>
                        ) : (
                            <button onClick={() => stopRecording(false)} className="flex-1 flex justify-center items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors">
                                <VideoOff className="w-4 h-4" /> ยกเลิกวิดีโอ
                            </button>
                        )}
                    </div>
                </div>

                {/* ฝั่งขวา: รายละเอียด (เหมือน TT เป๊ะ) */}
                <div className="flex-1 w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 min-w-0">
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <p className="text-lg font-bold text-gray-900">{orderData.tracking_number}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">Order SN: {orderData.order_sn}</p>
                            {IsPack ? (
                                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-green-100 text-green-700"><Package size={13} /> แพ็คครบแล้ว</span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700"><ClockIcon size={13} /> กำลังแพ็ค</span>
                            )}
                        </div>
                        <div className="text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">{packedQuantity} / {totalQuantity}</div>
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div>
                        <label className="text-gray-500 text-xs font-medium block mb-1.5">สแกนสินค้าเพื่อเช็ค</label>
                        <div className="flex gap-2">
                            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} placeholder="สแกน barcode สินค้า..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#ee4d2d]" />
                            <button onClick={() => { stopRecording(false); onBack(); }} className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600 font-medium">ยกเลิก</button>
                        </div>
                        {unknownBarcode && <div key={flashKey} className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg animate-pulse"><AlertCircle className="w-3.5 h-3.5" /> ไม่พบ barcode <span className="font-mono">{unknownBarcode}</span></div>}
                    </div>
                    <div className="h-px bg-gray-200" />
                    <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                        {orderData.products.map(p => <ProductVerifyRow key={p.barcode ?? p.sku} product={p} scanned={p.barcode ? (scanCounts[p.barcode] ?? 0) : 0} />)}
                    </div>
                    <div className="mt-auto pt-4 flex gap-3">
                        <button onClick={handleShopeeSave} className="bg-[#ee4d2d] hover:bg-[#d73f21] text-white font-bold py-3 px-6 rounded-xl transition-colors flex-1 shadow-sm text-sm">
                            บันทึกและอัปโหลดวิดีโอ (Shopee)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
