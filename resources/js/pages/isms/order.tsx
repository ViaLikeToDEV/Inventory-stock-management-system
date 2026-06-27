import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag, ScanLine, CheckCircle2, AlertCircle, Package, Clock as ClockIcon, Video, VideoOff, Circle, UploadCloud, Folder} from 'lucide-react';
import { ScannerStatusBar } from '@components/ScannerStatusBar';
import { ShopeePanel } from '@components/ShopeePanel';
import { ShopeeVerifyPage } from '@components/ShopeeVerifyPage';
import { ProductVerifyRow } from '@components/ProductVerifyRow';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Platform = 'tiktok' | 'shopee';
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
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState('');

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
                let currentDeviceId = selectedDevice;

                // 1. ถ้ายังไม่มีการเลือกกล้อง ให้ดึงลิสต์กล้องมาเซ็ตก่อน
                if (!currentDeviceId) {
                    const allDevices = await navigator.mediaDevices.enumerateDevices();
                    const cameraLists = allDevices.filter((d) => d.kind === 'videoinput');

                    setDevices(cameraLists);

                    if (cameraLists.length > 0) {
                        currentDeviceId = cameraLists[0].deviceId;
                        setSelectedDevice(currentDeviceId);
                    } else {
                        throw new Error('ไม่พบกล้องในอุปกรณ์นี้');
                    }
                }

                // 2. เคลียร์สตรีมเก่าทิ้งก่อนเปิดสตรีมใหม่ (สำคัญมากเวลาสลับกล้อง)
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                }

                // 3. ใช้ deviceId ในการจับกล้อง แทนการฟิกซ์ facingMode
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined },
                    audio: true
                });

                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;

            } catch (err) {
                console.error('ไม่สามารถเปิดกล้องได้:', err);
            }
        };

        const stopCamera = () => {
            // เช็คก่อนว่า stopRecording มีการเรียกใช้จริงๆ หรือ error ไหม
            if (typeof stopRecording === 'function') stopRecording(false);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };

        // เงื่อนไขในการเริ่มหรือหยุดกล้อง
        if (selectedOrderId || shopeeOrder) {
            startCamera();
        } else {
            stopCamera();
        }

        // Cleanup function
        return () => stopCamera();

    // 4. เพิ่ม selectedDevice เข้าไปใน Dependency ด้วย กล้องจะได้รีเฟรชเวลาสลับกล้อง
    }, [selectedOrderId, shopeeOrder, selectedDevice]);

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
                    devices={devices}
                    selectedDevice={selectedDevice}
                    setSelectedDevice={(id) => setSelectedDevice(id)}
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
                // <div className="fixed inset-4 md:inset-10 z-[999] flex flex-col rounded-2xl border border-slate-300/50 bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(148,163,184,0.15)] text-slate-700 font-mono overflow-hidden">
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
