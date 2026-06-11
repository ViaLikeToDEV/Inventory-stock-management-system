import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, AlertCircle, Package, Clock as ClockIcon, Video, VideoOff } from 'lucide-react';
import { ScannerStatusBar } from './ScannerStatusBar';
import { ProductVerifyRow } from './ProductVerifyRow';
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
    devices: MediaDeviceInfo[]; selectedDevice: string;setSelectedDevice: (deviceId: string) => void;
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

                    {devices.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedDevice}
                                        onChange={(e) => setSelectedDevice(e.target.value)}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"
                                    >
                                        {devices.map((device, index) => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `กล้อง ${index + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
                                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                                    <Package size={13} /> แพ็คครบแล้ว
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                                    <ClockIcon size={13} /> กำลังแพ็ค
                                </span>
                            )}
                        </div>
                        <div className="text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                            {packedQuantity} / {totalQuantity}
                        </div>
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* โซนที่ 1: ล็อคการสแกน */}
                    <div className={IsPack ? "opacity-60" : ""}>
                        <label className="text-gray-500 text-xs font-medium block mb-1.5">สแกนสินค้าเพื่อเช็ค</label>
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                // disabled={IsPack} // <-- ตัวแปรสำคัญ: ปิดการพิมพ์/สแกนเมื่อแพ็คครบ
                                placeholder={"สแกน barcode สินค้า..."}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#ee4d2d] disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {/* ปุ่มยกเลิก ไม่ควรโดนล็อค ให้ User กดถอยกลับได้เสมอ */}
                            <button
                                onClick={() => { stopRecording(false); onBack(); }}
                                className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600 font-medium bg-white"
                            >
                                ยกเลิก
                            </button>
                        </div>
                        {unknownBarcode && (
                            <div key={flashKey} className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" /> ไม่พบ barcode <span className="font-mono">{unknownBarcode}</span>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-200" />

                    {/* โซนที่ 2: แสดงผล List สินค้า (ถ้าอยากให้ดูจางๆ ทื่อๆ ตอนแพ็คเสร็จ ก็ใส่ Class เข้าไป) */}
                    <div className={`flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1 transition-all ${IsPack ? 'opacity-70 pointer-events-none' : ''}`}>
                        {orderData.products.map(p => (
                            <ProductVerifyRow
                                key={p.barcode ?? p.sku}
                                product={p}
                                scanned={p.barcode ? (scanCounts[p.barcode] ?? 0) : 0}
                            />
                        ))}
                    </div>

                    {/* โซนที่ 3: ปุ่มบันทึก (ปล่อยให้กดได้ หรือจะทำ Animation เรียกร้องความสนใจตอน IsPack=true ก็ได้) */}
                    <div className="mt-auto pt-4 flex gap-3">
                        <button
                            onClick={handleShopeeSave}
                            // ถ้าเป็นสถานะ View Only ค่อยใส่ disabled หรือ pointer-events-none ตรงนี้
                            className={`bg-[#ee4d2d] hover:bg-[#d73f21] text-white font-bold py-3 px-6 rounded-xl transition-all flex-1 shadow-sm text-sm ${IsPack ? 'ring-4 ring-red-100' : ''}`}
                        >
                            บันทึกและอัปโหลดวิดีโอ (Shopee)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
