import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Folder } from 'lucide-react';

import { ShopeeVerifyPage } from '@components/ShopeeVerifyPage';
import { UniversalPackScan } from '@components/universalpackscan';

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
    // 🟢 Video Recording States (For both TT and Shopee)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [saveDirectoryHandle, setSaveDirectoryHandle] = useState<any>(null);
    const [uploadQueue, setUploadQueue] = useState<Record<string, UploadState>>({});
    const [shopeeOrder, setShopeeOrder] = useState<ShopeeOrder | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // 📌 ตัวเช็ค Environment
    const isNativePHP = () => {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('nativephp') || ua.includes('electron');
    };
    useEffect(() => {
        const startCamera = async () => {
            try {
                let currentDeviceId = selectedDevice;

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

                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                }

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
            if (typeof stopRecording === 'function') stopRecording(false);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };

        if (shopeeOrder) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
    }, [shopeeOrder, selectedDevice]);

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

    // 📌 ยุบรวมแจ้งเตือนสำเร็จให้เป็นฟังก์ชันเดียว จะได้ไม่ต้องเขียนซ้ำซ้อน
    const showSuccessAlert = async () => {
        const { default: Swal } = await import('sweetalert2');
        Swal.fire({
            icon: 'success',
            title: 'เชื่อมต่อสำเร็จ',
            text: '✅ช่องค้นหาและแพ็คออเดอร์ปลดล็อคแล้ว',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: { popup: 'rounded-xl' }
        });
    };

    // 📌 Adaptive Select Directory
    const handleSelectDirectory = async () => {
        if (isPickerOpen) return;
        setIsPickerOpen(true);
        try {
            if (isNativePHP()) {
                // สำหรับ NativePHP
                const res = await fetch('/api/select-directory', { method: 'POST' });
                const { path } = await res.json();
                if (!path) return; // user กด cancel
                setSaveDirectoryHandle(path); // เก็บเป็น string path
                showSuccessAlert();
            } else {
                // สำหรับ Web App ปกติ
                // @ts-ignore
                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                setSaveDirectoryHandle(dirHandle); // เก็บเป็น FileSystemDirectoryHandle
                showSuccessAlert();
            }
        } catch (error) {
            console.error('เลือกโฟลเดอร์ไม่สำเร็จ:', error);
        } finally {
            setIsPickerOpen(false);
        }
    };

    // 📌 Adaptive Save Video (ตัวปัญหาของนายโดนแก้ตรงนี้แหละ)
    const saveVideoLocally = async (blob: Blob, fileName: string) => {
        if (!saveDirectoryHandle) {
            alert('🚨 กรุณากดเลือกโฟลเดอร์บันทึกคลิป (ปุ่มบนตาราง) ก่อนเริ่มงานครับ!');
            return false;
        }

        try {
            const now = new Date();
            const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            if (isNativePHP()) {
                // 🚀 เซฟแบบ NativePHP (ส่งผ่าน API)
                const base64 = await blobToBase64(blob);
                const res = await fetch('/api/save-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: saveDirectoryHandle, // string path
                        yearMonth,
                        fileName,
                        video: base64
                    })
                });
                const result = await res.json();
                return result.success === true;
            } else {
                // 🌐 เซฟแบบ Web App (ใช้ File System Access API ของเดิมใน src 2)
                const monthDirHandle = await saveDirectoryHandle.getDirectoryHandle(yearMonth, { create: true });
                const fileHandle = await monthDirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                return true;
            }
        } catch (error) {
            console.error('Error saving video:', error);
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
    }, []);

    const stopRecording = (saveFile: boolean, targetOrderId?: string) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            setIsRecording(false); return;
        }
        if (saveFile && targetOrderId) {
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const fileName = getFileName(targetOrderId);

                // รอเซฟลงเครื่องให้เสร็จก่อน
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

    if (shopeeOrder) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in">
                <div className="bg-[#eef1f8] w-full h-full max-w-7xl rounded-2xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col">
                    <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Shopee Verification Window</span>
                        </div>
                        <button
                            onClick={() => { stopRecording(false, shopeeOrder.order_sn); setShopeeOrder(null); }}
                            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors font-sans px-2 py-1 rounded-md hover:bg-gray-100"
                        >
                            ปิดหน้าต่าง (Esc)
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
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
                </div>
            </div>
        );
    }

    const FolderIcon = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            <path d="M16 3l-4 4-4-4" />
        </svg>
    );

    const CheckIcon = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );

    const baseStyle = "flex items-center gap-1.5 px-5 py-[7px] rounded-lg transition-all duration-150 outline-none focus-visible:ring-2"

    const unconnectedStyle = `
    ${baseStyle}
    bg-gradient-to-br from-violet-600 to-blue-500
    text-white shadow-sm
    hover:opacity-90 hover:shadow-md
    focus-visible:ring-violet-400
    active:scale-[0.98]
    `

    const connectedStyle = `
    ${baseStyle}
    bg-green-50 text-green-700
    border border-green-200
    hover:bg-green-100 hover:border-green-400
    focus-visible:ring-green-400
    active:scale-[0.98]
    `

    return (
        <div className="p-8 bg-[#eef1f8] min-h-full flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSelectDirectory}
                    disabled={isPickerOpen}
                    className={`${saveDirectoryHandle ? connectedStyle : unconnectedStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {saveDirectoryHandle ? (
                        <>
                            <CheckIcon />
                            <span>เชื่อมต่อแล้ว</span>
                        </>
                    ) : (
                        <>
                            <FolderIcon />
                            <span>แฟ้มบันทึกวิดีโอ</span>
                        </>
                    )}
                </button>
            </div>

            <UniversalPackScan
                onOrderFound={(order) => setShopeeOrder(order)}
                saveDirectoryHandle={saveDirectoryHandle}
            />
        </div>
    );
}
