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

    const [videoWidth, setVideoWidth] = useState(380);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

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

    const startResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        // คำนวณความกว้างใหม่ตามตำแหน่งเมาส์ (หักลบกับขอบซ้ายของตู้คอนเทนเนอร์)
        const container = resizeRef.current?.parentElement;
        if (container) {
            const containerLeft = container.getBoundingClientRect().left;
            const newWidth = e.clientX - containerLeft - 10; // ลบ offset นิดหน่อยเพื่อให้สมูท
            if (newWidth > 260 && newWidth < 600) { // กั้น min-max ไว้ไม่ให้เพี้ยน
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
        <div ref={resizeRef} className="flex flex-col gap-4 w-full max-w-7xl mx-auto p-6 select-none">
      <div className="flex items-center gap-4">
        <button onClick={() => { stopRecording(false); onBack(); }} className="p-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:text-gray-900 transition-all shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1"><ScannerStatusBar isFocused={isFocused} mode="verify" /></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 items-start w-full relative">

        {/* 📹 ฝั่งซ้าย: กล้อง + วิดีโอ (ปรับความกว้าง Dynamic ตาม State ตัวแปร videoWidth) */}
        <div
          style={{ width: window.innerWidth >= 1024 ? `${videoWidth}px` : '100%' }}
          className="flex flex-col gap-3 w-full flex-shrink-0 bg-white p-3 rounded-xl border border-gray-200 shadow-sm"
        >
          <div className="bg-black rounded-xl overflow-hidden aspect-[4/3] relative shadow-inner">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 border-2 border-white/50 rounded-lg relative">
                <span className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#ee4d2d]" />
                <span className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#ee4d2d]" />
                <span className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#ee4d2d]" />
                <span className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#ee4d2d]" />
              </div>
            </div>
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full text-white text-xs font-bold tracking-wider">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" /> REC {formatTime(recordingTime)}
              </div>
            )}
          </div>

          {devices.length > 0 && (
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-orange-500 bg-gray-50 outline-none w-full text-gray-600"
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `กล้อง ${index + 1}`}</option>
              ))}
            </select>
          )}

          <div className="flex gap-2 w-full">
            {!isRecording ? (
              <button onClick={startRecording} className="flex-1 flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm">
                <Video className="w-3.5 h-3.5" /> เริ่มบันทึกวิดีโอ
              </button>
            ) : (
              <button onClick={() => stopRecording(false)} className="flex-1 flex justify-center items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-colors">
                <VideoOff className="w-3.5 h-3.5" /> ยกเลิกวิดีโอ
              </button>
            )}
          </div>
        </div>

        {/* 🎛️ แท่งสำหรับคลิกลากขยายเฟรม (Resize Splitter Bar) แสดงเฉพาะจอใหญ่เดสก์ท็อป */}
        <div
          onMouseDown={startResize}
          className={`hidden lg:flex items-center justify-center w-2 hover:w-3 self-stretch bg-transparent hover:bg-orange-400/30 cursor-col-resize transition-all rounded-md z-20 group ${isResizing ? 'bg-orange-500/40 w-3' : ''}`}
        >
          <MoveHorizontal className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        </div>

        {/* 📋 ฝั่งขวา: รายละเอียดออเดอร์ (ขยายพื้นที่เต็มที่ตามการยืดหดของฝั่งซ้าย) */}
        <div className="flex-1 w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 min-w-0 self-stretch">
          <div className="flex justify-between items-start w-full">
            <div>
              <p className="text-xl font-extrabold text-gray-900 tracking-tight">{orderData.tracking_number}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Order SN: {orderData.order_sn}</p>
              {IsPack ? (
                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-700 font-medium">
                  <Package size={12} /> แพ็คครบแล้ว
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 font-medium">
                  <ClockIcon size={12} /> กำลังแพ็ค
                </span>
              )}
            </div>
            <div className="text-base font-bold bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-700 shadow-sm">
              {packedQuantity} / {totalQuantity}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div className={IsPack ? "opacity-50" : ""}>
            <label className="text-gray-400 text-xs font-semibold block mb-1.5">ช่องสแกนสินค้าตัวเลือก</label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={IsPack}

                // 🟢 เพิ่ม Style ให้ดูว่าโดนล็อค (disabled:...)
                placeholder={IsPack ? "ออเดอร์นี้แพ็คเสร็จแล้ว สแกนไม่ได้" : "สแกนบาร์โค้ดสินค้า..."}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#ee4d2d] focus:ring-1 focus:ring-[#ee4d2d]
                            disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
              <button onClick={() => { stopRecording(false); onBack(); }} className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-500 font-medium bg-white shadow-sm">ยกเลิก</button>
            </div>
            {unknownBarcode && (
              <div key={flashKey} className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg animate-pulse border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> ไม่พบ SKU บาร์โค้ด: <span className="font-mono font-bold">{unknownBarcode}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100" />

          {/* โซนรายการสินค้า ยืดหยุ่นขยายพื้นที่ตามขนาดจอที่ลากขยายได้ยอดเยี่ยม */}
          <div className={`flex flex-col gap-2 flex-1 overflow-y-auto max-h-[400px] pr-1 transition-all ${IsPack ? 'opacity-70 pointer-events-none' : ''}`}>
            {orderData.products.map(p => (
              <ProductVerifyRow key={p.barcode ?? p.sku} product={p} scanned={p.barcode ? (scanCounts[p.barcode] ?? 0) : 0} />
            ))}
          </div>

          <div className="pt-2 flex gap-3 mt-auto">
            <button
              onClick={handleShopeeSave}
              className={`bg-[#ee4d2d] hover:bg-[#d73f21] text-white font-bold py-3.5 px-6 rounded-xl transition-all flex-1 shadow-md text-sm tracking-wide ${IsPack ? 'ring-4 ring-red-100' : ''}`}
            >
              บันทึกแพ็คเสร็จสิ้น และอัปโหลดวิดีโอ (Shopee)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
