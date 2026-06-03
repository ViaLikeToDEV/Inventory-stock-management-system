import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Video, VideoOff, Circle, UploadCloud, AlertCircle } from 'lucide-react';

// 🟢 สร้าง Type สำหรับเก็บสถานะคิวการอัปโหลด
type UploadState = {
    status: 'uploading' | 'success' | 'error';
    progress: number;
    blob: Blob;
    fileName: string;
};

export default function Packing() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 🔴 State สำหรับการบันทึกวิดีโอ
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    // 🟢 State สำหรับจัดการโฟลเดอร์เครื่องคอม และ คิวอัปโหลด
    const [saveDirectoryHandle, setSaveDirectoryHandle] = useState<any>(null);
    const [uploadQueue, setUploadQueue] = useState<Record<string, UploadState>>({});

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ดึงข้อมูลออเดอร์
    useEffect(() => {
        fetch('/get-packing-orders')
            .then(res => res.json())
            .then(data => {
                const validOrders = data.data?.filter((item: any) => item['Order ID']) || [];
                setOrders(validOrders);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching orders:', err);
                setLoading(false);
            });
    }, []);

    // เปิด-ปิด กล้อง
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("ไม่สามารถเปิดกล้องได้:", err);
            }
        };

        const stopCamera = () => {
            stopRecording(false);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };

        if (selectedOrderId) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
    }, [selectedOrderId]);

    // สร้างชื่อไฟล์
    const getFileName = (orderId: string) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${orderId}_${hour}${minute}${second}.webm`;
    };

    // แปลงไฟล์เป็น Base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // 🟢 ฟังก์ชันอัปโหลดเบื้องหลัง (หลบ CORS ด้วย fetch)
    const uploadToGoogleDriveBackground = async (blob: Blob, fileName: string, orderId: string) => {
        try {
            const base64 = await blobToBase64(blob);

            // 🚨 วาง URL ของ Google App Script (ตัวที่ทำระบบสร้างโฟลเดอร์) ตรงนี้
            const response = await fetch(
                "https://script.google.com/macros/s/AKfycby7pmxLZVsHwyDi_Btv3Qd1ANqV1Rd2Qr4W0YfhKfSJ6_SgCclXQV48nPCeDXXYSYtxuQ/exec",
                {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Content-Type": "text/plain;charset=utf-8" // สำคัญมาก ป้องกัน CORS Error
                    },
                    body: JSON.stringify({
                        fileName,
                        video: base64
                    })
                }
            );

            const result = await response.json();

            if (result.status === 'success') {
                setUploadQueue(prev => ({
                    ...prev,
                    [orderId]: { ...prev[orderId], status: 'success', progress: 100 }
                }));
            } else {
                throw new Error("Upload response error");
            }

        } catch (error) {
            console.error("Upload failed:", error);
            setUploadQueue(prev => ({
                ...prev,
                [orderId]: { ...prev[orderId], status: 'error' }
            }));
        }
    };

    // เลือกโฟลเดอร์เซฟลงเครื่อง
    const handleSelectDirectory = async () => {
        try {
            // @ts-ignore
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setSaveDirectoryHandle(dirHandle);
            alert('เชื่อมต่อโฟลเดอร์ในเครื่องแล้วครับ!');
        } catch (error) {
            console.error('ยกเลิกการเลือกโฟลเดอร์:', error);
        }
    };

    // เซฟลงเครื่อง
    const saveVideoLocally = async (blob: Blob, fileName: string) => {
        if (!saveDirectoryHandle) {
            alert('🚨 กรุณากดเลือกโฟลเดอร์บันทึกคลิป (ปุ่มสีน้ำเงินหน้าตาราง) ก่อนเริ่มงานครับ!');
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
            console.error('Local Save Error:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกไฟล์ลงคอมพิวเตอร์');
            return false;
        }
    };

    // เริ่มอัดวิดีโอ
    const startRecording = () => {
        if (!streamRef.current) return;
        recordedChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';

        const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {});

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingTime(0);

        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    };

    // 🟢 กดอัปโหลดใหม่ (กรณีเน็ตหลุด)
    const handleRetryUpload = (orderId: string) => {
        const item = uploadQueue[orderId];
        if (!item || !item.blob) return;

        setUploadQueue(prev => ({
            ...prev,
            [orderId]: { ...prev[orderId], status: 'uploading', progress: 0 }
        }));

        uploadToGoogleDriveBackground(item.blob, item.fileName, orderId);
    };

    // หยุดอัดและจัดการไฟล์
    const stopRecording = (saveFile: boolean) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            setIsRecording(false);
            setRecordingTime(0);
            return;
        }

        if (saveFile) {
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const currentOrderId = selectedOrderId!;
                const fileName = getFileName(currentOrderId);

                // สเตป 1: เซฟลงเครื่องก่อน
                const localSaveSuccess = await saveVideoLocally(blob, fileName);

                if (localSaveSuccess) {
                    // สเตป 2: เด้งกลับหน้าตารางหลักทันที
                    setSelectedOrderId(null);

                    // สเตป 3: เอาไฟล์ยัดเข้าคิวและอัปโหลดขึ้น Drive เบื้องหลัง
                    setUploadQueue(prev => ({
                        ...prev,
                        [currentOrderId]: { status: 'uploading', progress: 0, blob, fileName }
                    }));

                    uploadToGoogleDriveBackground(blob, fileName, currentOrderId);
                }

                recordedChunksRef.current = [];
            };
        } else {
            mediaRecorderRef.current.onstop = () => { recordedChunksRef.current = []; };
        }

        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingTime(0);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // ==========================================
    // 🔴 หน้าจอเปิดกล้อง
    // ==========================================
    if (selectedOrderId) {
        const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);
        return (
            <div className="p-8 bg-white min-h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="flex flex-col">
                        <div className="bg-[#d9d9d9] aspect-[4/3] w-full relative flex items-center justify-center overflow-hidden">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover absolute inset-0" />
                            {!streamRef.current && <span className="text-gray-500 font-medium">กำลังเปิดกล้อง...</span>}
                            {isRecording && (
                                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full z-10">
                                    <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
                                    REC {formatTime(recordingTime)}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-4">
                            {!isRecording ? (
                                <button onClick={startRecording} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-[20px] transition-colors">
                                    <Video className="w-5 h-5" /> เริ่มบันทึก
                                </button>
                            ) : (
                                <button onClick={() => stopRecording(false)} className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-[20px] transition-colors">
                                    <VideoOff className="w-5 h-5" /> ยกเลิกบันทึก
                                </button>
                            )}
                        </div>

                        <button onClick={() => { stopRecording(false); setSelectedOrderId(null); }} className="mt-4 text-gray-500 hover:text-gray-800 transition-colors w-fit">
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
                            <button onClick={() => { stopRecording(false); setSelectedOrderId(null); }} className="bg-[#cc0000] hover:bg-red-700 text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors">
                                ยกเลิก
                            </button>
                            <button onClick={() => stopRecording(true)} className="bg-[#2b3e52] hover:bg-[#1e2d3d] text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors">
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // 🔵 หน้าตารางหลัก
    // ==========================================
    const uniqueOrders = Array.from(new Set(orders.map(o => o['Order ID'])));
    const totalPages = Math.ceil(uniqueOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = uniqueOrders.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="p-8 bg-[#eef1f8] min-h-full">
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={handleSelectDirectory}
                    className={`px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 ${saveDirectoryHandle ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {saveDirectoryHandle ? '✅ เชื่อมต่อโฟลเดอร์ในเครื่องแล้ว' : '📁 เลือกโฟลเดอร์บันทึกคลิป'}
                </button>

                <div className="flex items-center gap-3">
                    <label className="text-gray-600 font-medium">แสดงหน้าละ :</label>
                    <select
                        className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-700 outline-none focus:border-blue-500 shadow-sm"
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    >
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

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

                            // ดึงสถานะคิวอัปโหลดของออเดอร์นี้
                            const qItem = uploadQueue[uniqueId];

                            return (
                                <div key={index} className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 items-center py-4 px-8 border-b border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition">
                                    <div className="truncate" title={orderInfo['Order ID']}>{orderInfo['Order ID']}</div>
                                    <div className="truncate font-medium text-gray-700" title={orderInfo['Product Name']}>
                                        {orderInfo['Product Name']} {hasMoreItems ? '(และสินค้าอื่นๆ)' : ''}
                                    </div>
                                    <div className="text-center text-base font-bold text-blue-600">{totalQty}</div>

                                    {/* 🟢 ส่วนแสดงสถานะ (แอนิเมชันหลอดโหลด / ปุ่ม Retry) */}
                                    <div className="text-right flex justify-end">
                                        {qItem?.status === 'uploading' ? (
                                            <div className="w-32 flex flex-col items-end gap-2">
                                                <span className="text-xs text-blue-600 font-bold flex items-center gap-2">
                                                    <UploadCloud className="w-4 h-4 animate-bounce" />
                                                    กำลังอัปโหลด...
                                                </span>
                                                <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden relative">
                                                    <div className="absolute top-0 bottom-0 bg-blue-500 rounded-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] translate-x-full"></div>
                                                </div>
                                            </div>
                                        ) : qItem?.status === 'error' ? (
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> ล้มเหลว
                                                </span>
                                                <button onClick={() => handleRetryUpload(uniqueId as string)} className="bg-white border border-red-300 hover:bg-red-50 text-red-600 px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm">
                                                    🔄 อัปโหลดใหม่
                                                </button>
                                            </div>
                                        ) : orderInfo['IsPacked'] == 0 && qItem?.status !== 'success' ? (
                                            <button className="bg-[#eab308] hover:bg-[#ca9a04] text-white px-6 py-2 rounded font-medium shadow transition-colors" onClick={() => setSelectedOrderId(orderInfo['Order ID'])}>
                                                เริ่มทำงาน
                                            </button>
                                        ) : (
                                            <span className="text-green-600 font-bold px-6 py-2 bg-green-50 rounded border border-green-200">แพ็คเสร็จแล้ว ✅</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {!loading && uniqueOrders.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-8 py-4">
                        <div className="text-sm text-gray-600">แสดง {startIndex + 1} ถึง {Math.min(startIndex + itemsPerPage, uniqueOrders.length)} จากทั้งหมด {uniqueOrders.length} รายการ</div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-3 py-2 rounded flex items-center transition-colors ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`}>
                                <ChevronLeft className="w-5 h-5 mr-1" /> ก่อนหน้า
                            </button>
                            <span className="text-gray-700 font-medium px-4">หน้า {currentPage} / {totalPages || 1}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`px-3 py-2 rounded flex items-center transition-colors ${currentPage === totalPages || totalPages === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`}>
                                ถัดไป <ChevronRight className="w-5 h-5 ml-1" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
