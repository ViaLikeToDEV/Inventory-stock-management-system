// components/ShopeeVerifyPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, AlertCircle, Package, Clock as ClockIcon, Video, VideoOff, MoveHorizontal } from 'lucide-react';
import { ScannerStatusBar } from '@components/ScannerStatusBar';
import { ProductVerifyRow } from '@components/ProductVerifyRow';
import axios from 'axios';

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

export function ShopeeVerifyPage({
    orderData, onBack, videoRef, isRecording, recordingTime, formatTime, startRecording, stopRecording, devices, selectedDevice, setSelectedDevice
}: {
    orderData: ShopeeOrder; onBack: () => void; videoRef: React.RefObject<HTMLVideoElement>;
    isRecording: boolean; recordingTime: number; formatTime: (s: number) => string;
    startRecording: () => void; stopRecording: (save: boolean) => void;
    devices: MediaDeviceInfo[]; selectedDevice: string; setSelectedDevice: (deviceId: string) => void;
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

    const [videoWidth, setVideoWidth] = useState(420); // ขยายขนาดกล้องเริ่มต้นให้ใหญ่ขึ้นอีกนิด (380 -> 420)
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

        if (!target?.barcode) {
            setUnknownBarcode(barcode);
            setFlashKey(k => k + 1);
            return;
        }

        const current = scanCounts[target.barcode] ?? 0;

        if (current >= target.quantity) {
            setFlashKey(k => k + 1);
            return;
        }

        if (!isRecording) {
            startRecording();
        }

        setScanCounts({ ...scanCounts, [target.barcode]: current + 1 });
    }, [orderData, scanCounts, isRecording, startRecording]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = e.currentTarget.value.trim();
        if (!val) return;
        handleProductScan(val);
        setQuery('');
    };

    const sortedProducts = React.useMemo(() => {
    return [...orderData.products].sort((a, b) => {
        const aScanned = a.barcode ? (scanCounts[a.barcode] ?? 0) : 0;
        const bScanned = b.barcode ? (scanCounts[b.barcode] ?? 0) : 0;
        const aDone = aScanned >= a.quantity ? 1 : 0;
        const bDone = bScanned >= b.quantity ? 1 : 0;

        return aDone - bDone; // ตัวที่ยังไม่เสร็จ (0) จะอยู่ก่อนตัวที่เสร็จแล้ว (1)
    });
}, [orderData.products, scanCounts]);

useEffect(() => {
    if (IsPack || isAllDone) return;

    // หา Barcode หรือ SKU แรกในรายการที่จัดเรียงแล้วที่ยังแพ็กไม่ครบ
    const nextTarget = sortedProducts.find(p => {
        const currentScanned = p.barcode ? (scanCounts[p.barcode] ?? 0) : 0;
        return currentScanned < p.quantity;
    });

    if (nextTarget) {
        const targetId = nextTarget.barcode ?? nextTarget.sku;
        const targetElement = rowRefs.current[targetId];

        if (targetElement) {
            // สั่ง Scroll กล่องรายการสินค้านั้นให้เด้งมาอยู่ในโฟลเดอร์สายตาอัตโนมัติ
            setTimeout(() => {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest', // ป้องกันหน้าจอหลักทั้งหน้าเลื่อนตาม เอาแค่กล่องตารางย่อยพอ
                });
            }, 50); // delay สั้นๆ เพื่อให้ DOM สลับจัดเรียงแถวเสร็จก่อน
        }
    }
}, [scanCounts, sortedProducts, IsPack, isAllDone]);

    const handleShopeeSave = async () => {
        // เช็กยอดแพ็กของหน้างาน
        if (packedQuantity !== totalQuantity) {
            import('sweetalert2').then((Swal) => {
                Swal.default.fire({
                    icon: 'warning',
                    title: '<span style="font-size: 22px; font-weight: 900; color: #b45309;">แพ็กของยังไม่ครบ!</span>',
                    text: `กรุณาสแกนสินค้าให้ครบจำนวนก่อนบันทึกงาน (สถานะปัจจุบัน: ${packedQuantity}/${totalQuantity} ชิ้น)`,
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#ee4d2d',
                    customClass: { popup: 'rounded-3xl font-sans' }
                });
            });
            return;
        }

        stopRecording(true);
        import('sweetalert2').then(async (Swal) => {
            Swal.default.fire({
                title: 'กำลังบันทึกข้อมูลออเดอร์...',
                allowOutsideClick: false,
                showConfirmButton: false,
                customClass: { popup: 'rounded-3xl font-sans' },
                didOpen: () => Swal.default.showLoading()
            });

            try {
                const response = await axios.post(route('shopee-setpacked'), {
                    order_sn: orderData.order_sn,
                    tracking_number: orderData.tracking_number
                });

                if (response.data?.status === 'success') {
                    await Swal.default.fire({
                        icon: 'success',
                        title: `<span style="font-size: 20px; font-weight: 900;">${response.data?.message || 'บันทึกสำเร็จ'}</span>`,
                        timer: 1500,
                        showConfirmButton: false,
                        customClass: { popup: 'rounded-3xl font-sans' }
                    });
                    onBack();
                } else {
                    throw new Error(response.data?.message || 'เกิดข้อผิดพลาดในการบันทึก');
                }
            } catch (error: any) {
                const errorMessage = error.response?.data?.message || error.message || 'ระบบขัดข้อง';
                const errorStatus = error.response?.data?.status || 'error';

                Swal.default.fire({
                    icon: errorStatus === 'warning' ? 'warning' : 'error',
                    title: '<span style="font-size: 22px; font-weight: 900;">ไม่สามารถบันทึกได้!</span>',
                    text: errorMessage,
                    confirmButtonText: 'ตกลง',
                    customClass: { popup: 'rounded-3xl font-sans' }
                });
            }
        });
    };

    const startResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const container = resizeRef.current?.parentElement;
            if (container) {
                const containerLeft = container.getBoundingClientRect().left;
                const newWidth = e.clientX - containerLeft - 10;
                if (newWidth > 300 && newWidth < 700) { // ขยับสเกล min-max ให้รับขนาดจอและกล้องที่ใหญ่ขึ้น
                    setVideoWidth(newWidth);
                }
            }
        };

        const handleMouseUp = () => { setIsResizing(false); };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div ref={resizeRef} className="flex flex-col gap-5 w-full max-w-7xl mx-auto p-4 md:p-6 select-none text-gray-900">
            {/* ส่วนหัวหน้าต่าง คลุมสเตตัสด้วยกล่องหนา */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => { stopRecording(false); onBack(); }}
                    className="p-3.5 bg-white text-gray-500 border-2 border-gray-200 rounded-2xl hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm flex-shrink-0"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1"><ScannerStatusBar isFocused={isFocused} mode="verify" /></div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 items-start w-full relative">

                {/* 📹 ฝั่งซ้าย: กล้องไลฟ์สด + เลือก Device */}
                <div
                    style={{ width: window.innerWidth >= 1024 ? `${videoWidth}px` : '100%' }}
                    className="flex flex-col gap-4 w-full flex-shrink-0 bg-white p-4 rounded-3xl border-2 border-gray-250 shadow-sm"
                >
                    <div className="bg-black rounded-2xl overflow-hidden aspect-[4/3] relative shadow-inner border border-gray-950">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-40 h-40 border-2 border-white/40 rounded-xl relative">
                                <span className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#ee4d2d]" />
                                <span className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#ee4d2d]" />
                                <span className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#ee4d2d]" />
                                <span className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#ee4d2d]" />
                            </div>
                        </div>
                        {isRecording && (
                            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/80 px-4 py-2 rounded-full text-white text-sm font-black tracking-wider shadow-lg border border-white/10">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" /> REC {formatTime(recordingTime)}
                            </div>
                        )}
                    </div>

                    {devices.length > 0 && (
                        <select
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            className="border-2 border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:border-[#ee4d2d] bg-gray-50 outline-none w-full text-gray-700 transition-all"
                        >
                            {devices.map((device, index) => (
                                <option key={device.deviceId} value={device.deviceId}>{device.label || `กล้องถ่ายงาน ${index + 1}`}</option>
                            ))}
                        </select>
                    )}

                    <div className="flex gap-2 w-full">
                        {!isRecording ? (
                            <button onClick={startRecording} className="flex-1 flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-black py-3 px-4 rounded-xl transition-colors shadow-sm min-h-[46px]">
                                <Video className="w-5 h-5" /> เปิดระบบบันทึกคลิปด้วยมือ
                            </button>
                        ) : (
                            <button onClick={() => stopRecording(false)} className="flex-1 flex justify-center items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-black py-3 px-4 rounded-xl transition-colors min-h-[46px]">
                                <VideoOff className="w-5 h-5" /> ล้างคลิป / ยกเลิกอัด
                            </button>
                        )}
                    </div>
                </div>

                {/* 🎛️ แท่งลากขยายกรอบวิดีโอ (Resize Splitter Bar) */}
                <div
                    onMouseDown={startResize}
                    className={`hidden lg:flex items-center justify-center w-2.5 hover:w-3.5 self-stretch bg-transparent hover:bg-orange-500/20 cursor-col-resize transition-all rounded-md z-20 group ${isResizing ? 'bg-orange-500/40 w-3.5' : ''}`}
                >
                    <MoveHorizontal className="w-4 h-4 text-orange-500 opacity-0 group-hover:opacity-100 transition-all" />
                </div>

                {/* 📋 ฝั่งขวา: รายละเอียดสินค้าและข้อมูลแพ็กของออเดอร์ */}
                <div className="flex-1 w-full bg-white rounded-3xl border-2 border-gray-250 shadow-sm p-6 flex flex-col gap-4 min-w-0 self-stretch">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 w-full">
                        <div>
                            <p className="text-2xl font-black text-gray-950 tracking-tight font-mono selection:bg-[#ee4d2d]/10">{orderData.tracking_number}</p>
                            <p className="text-sm text-gray-500 font-mono mt-1 font-bold">Order SN: {orderData.order_sn}</p>

                            {IsPack ? (
                                <span className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold px-3 py-1.5 rounded-xl bg-green-100 text-green-800 border border-green-200">
                                    <Package size={14} /> ออเดอร์นี้แพ็คเรียบร้อยแล้ว
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                                    <ClockIcon size={14} className="animate-spin [animation-duration:3s]" /> กำลังตรวจสอบและสแกนของ
                                </span>
                            )}
                        </div>
                        {/* ป้ายนับยอดแพ็กขนาดเบิ้ม กระแทกสายตา */}
                        <div className="text-xl font-black bg-slate-100 border-2 border-gray-300 rounded-2xl px-6 py-3.5 text-gray-800 shadow-inner tracking-tight self-stretch sm:self-auto text-center">
                            {packedQuantity} / {totalQuantity}
                        </div>
                    </div>

                    <div className="h-px bg-gray-200" />

                    <div className={IsPack ? "opacity-50 pointer-events-none" : ""}>
                        <label className="text-gray-600 text-sm font-black block mb-2">ช่องป้อนสแกนบาร์โค้ดสินค้าในกล่อง</label>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                disabled={IsPack}
                                placeholder={IsPack ? "ออเดอร์นี้แพ็คเสร็จแล้ว ระบบปิดช่องสแกนอัตโนมัติ" : "ยิงบาร์โค้ดตัวสินค้าเพื่อเช็กสต็อกและเริ่มอัดคลิป..."}
                                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base font-bold outline-none transition-all focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/10 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={() => { stopRecording(false); onBack(); }}
                                className="border-2 border-gray-200 hover:bg-gray-100 px-5 py-3.5 rounded-xl text-base text-gray-700 font-bold bg-white shadow-sm transition-colors"
                            >
                                ย้อนกลับ
                            </button>
                        </div>

                        {/* กล่องแจ้งเตือนกรณียิงโค้ดหลุดระบบ หนาและเด่นชัดป้องกันพนักงานโยนของผิดลงกล่อง */}
                        {unknownBarcode && (
                            <div key={flashKey} className="mt-3 flex items-start gap-2.5 text-sm font-black text-amber-800 bg-amber-50 px-4 py-3 rounded-xl border-2 border-amber-300 shadow-sm animate-shake">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span>ระวัง! ไม่พบรายการสินค้าบาร์โค้ดนี้ในระบบ: </span>
                                    <span className="font-mono bg-amber-150 border border-amber-300 px-2 py-0.5 rounded ml-1 text-red-700 text-base">{unknownBarcode}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* โซนรายการตารางสินค้าในบิลออเดอร์ */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center pl-1">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                รายการสิ่งของที่ต้องใส่ในกล่องนี้ ({orderData.products.length} รายการ)
                            </p>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                ⇅ เรียงตามลำดับความสำคัญอัจฉริยะ
                            </span>
                        </div>

                        <div className={`flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1 transition-all scroll-smooth ${IsPack ? 'opacity-40 pointer-events-none' : ''}`}>
                            {sortedProducts.map(p => {
                                const id = p.barcode ?? p.sku;
                                const currentScanned = p.barcode ? (scanCounts[p.barcode] ?? 0) : 0;

                                return (
                                    <div
                                        key={id}
                                        ref={el => { rowRefs.current[id] = el; }} // ผูก element เข้ากับระบบนำทางเลื่อนจอ
                                        className="transition-all duration-300"
                                    >
                                        <ProductVerifyRow
                                            product={p}
                                            scanned={currentScanned}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ปุ่มยืนยันปิดกล่องส่งงานระดับ Big Size */}
                    <div className="pt-3 flex gap-3 mt-auto">
                        <button
                            onClick={handleShopeeSave}
                            className={`bg-[#ee4d2d] hover:bg-[#d73f21] text-white font-black py-4 px-6 rounded-2xl transition-all flex-1 shadow-md text-base tracking-wide ${IsPack ? 'ring-4 ring-red-200 opacity-40 cursor-not-allowed' : ''}`}
                        >
                            ปิดกล่อง — บันทึกแพ็คเสร็จสิ้น และอัปโหลดวิดีโอหลักฐาน (Shopee)
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
