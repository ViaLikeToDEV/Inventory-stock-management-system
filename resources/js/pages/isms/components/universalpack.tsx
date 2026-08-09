// components/Packing.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Folder, X } from 'lucide-react';

import { ShopeeVerifyPage } from '@components/ShopeeVerifyPage';
import { UniversalPackScan } from '@components/universalpackscan';
import { UploadQueuePanel, type UploadState } from '@components/UploadQueuePanel';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Platform = 'tiktok' | 'shopee';

const GAS_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycby7pmxLZVsHwyDi_Btv3Qd1ANqV1Rd2Qr4W0YfhKfSJ6_SgCclXQV48nPCeDXXYSYtxuQ/exec';

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
    const dismissTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const uploadXhrRef = useRef<Record<string, XMLHttpRequest>>({});
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

    const patchUpload = (orderId: string, patch: Partial<UploadState>) => {
        setUploadQueue(prev => (prev[orderId] ? { ...prev, [orderId]: { ...prev[orderId], ...patch } } : prev));
    };

    /**
     * อัปโหลดคลิปขึ้น Google Drive ผ่าน Apps Script
     * ใช้ XMLHttpRequest แทน fetch เพราะ fetch รายงานความคืบหน้าตอนอัปโหลดไม่ได้
     */
    const uploadToGoogleDriveBackground = async (blob: Blob, fileName: string, orderId: string) => {
        const markError = () => {
            delete uploadXhrRef.current[orderId];
            patchUpload(orderId, { status: 'error' });
        };

        try {
            patchUpload(orderId, { status: 'uploading', phase: 'encoding', progress: 0 });
            const base64 = await blobToBase64(blob);

            patchUpload(orderId, { phase: 'uploading', progress: 0 });

            const xhr = new XMLHttpRequest();
            xhr.open('POST', GAS_UPLOAD_URL, true);
            xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
            xhr.timeout = 5 * 60 * 1000; // 5 นาที กันค้าง 'uploading' ตลอดไปถ้า GAS ไม่ตอบ

            // ห้ามผูก listener กับ xhr.upload (onprogress/onload) — จะทำให้ browser บังคับส่ง CORS preflight (OPTIONS)
            // ซึ่ง Google Apps Script ตอบไม่ได้ (405 เสมอ) อัปโหลดจะพังทันทีด้วย CORS error
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                    patchUpload(orderId, { phase: 'processing', progress: 100 });
                }
            };

            xhr.onload = () => {
                delete uploadXhrRef.current[orderId];
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.status !== 'success') throw new Error('Upload response error');
                    patchUpload(orderId, { status: 'success', phase: 'processing', progress: 100 });
                } catch (error) {
                    console.error('Upload response error:', error);
                    markError();
                }
            };

            xhr.onerror = markError;
            xhr.onabort = markError;
            xhr.ontimeout = markError;

            uploadXhrRef.current[orderId] = xhr;
            xhr.send(JSON.stringify({ fileName, video: base64 }));
        } catch (error) {
            console.error('Error uploading video:', error);
            markError();
        }
    };

    const handleRetryUpload = (orderId: string) => {
        const item = uploadQueue[orderId];
        if (!item) return;
        uploadToGoogleDriveBackground(item.blob, item.fileName, orderId);
    };

    const handleDismissUpload = (orderId: string) => {
        const runningXhr = uploadXhrRef.current[orderId];
        if (runningXhr) {
            delete uploadXhrRef.current[orderId];
            runningXhr.abort();
        }

        setUploadQueue(prev => {
            const { [orderId]: _removed, ...rest } = prev;
            return rest;
        });
    };

    // 📌 การ์ดที่อัปโหลดสำเร็จจะหายเองใน 4 วินาที ส่วนตัวที่ล้มเหลวค้างไว้ให้กดลองใหม่
    useEffect(() => {
        const timers = dismissTimersRef.current;

        Object.entries(uploadQueue).forEach(([orderId, item]) => {
            if (item.status !== 'success' || timers[orderId]) return;
            timers[orderId] = setTimeout(() => {
                delete timers[orderId];
                handleDismissUpload(orderId);
            }, 4000);
        });

        Object.keys(timers).forEach((orderId) => {
            if (uploadQueue[orderId]?.status === 'success') return;
            clearTimeout(timers[orderId]);
            delete timers[orderId];
        });
    }, [uploadQueue]);

    useEffect(() => {
        const timers = dismissTimersRef.current;
        return () => {
            Object.values(timers).forEach(clearTimeout);
        };
    }, []);

    // 📌 แจ้งเตือนสำเร็จสไตล์พรีเมียม ขอบมนขนาดใหญ่เข้าชุดเดิม
    const showSuccessAlert = async () => {
        const { default: Swal } = await import('sweetalert2');
        Swal.fire({
            icon: 'success',
            title: '<span style="font-size: 20px; font-weight: 900;">เชื่อมต่อแฟ้มงานสำเร็จ</span>',
            text: '✅ ระบบจัดการคลังสินค้าและช่องสแกนออเดอร์พร้อมลุยแล้ว',
            timer: 2200,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: { popup: 'rounded-3xl font-sans p-5' }
        });
    };

    // 📌 Adaptive Select Directory
    const handleSelectDirectory = async () => {
        if (isPickerOpen) return;
        setIsPickerOpen(true);
        try {
            if (isNativePHP()) {
                const res = await fetch('/api/select-directory', { method: 'POST' });
                const { path } = await res.json();
                if (!path) return;
                setSaveDirectoryHandle(path);
                showSuccessAlert();
            } else {
                // @ts-ignore
                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                setSaveDirectoryHandle(dirHandle);
                showSuccessAlert();
            }
        } catch (error) {
            console.error('เลือกโฟลเดอร์ไม่สำเร็จ:', error);
        } window.blur(); {
            setIsPickerOpen(false);
        }
    };

    // 📌 Adaptive Save Video
    const saveVideoLocally = async (blob: Blob, fileName: string) => {
        if (!saveDirectoryHandle) {
            alert('🚨 กรุณากดเลือกโฟลเดอร์บันทึกคลิป (ปุ่มบนตาราง) ก่อนเริ่มงานครับ!');
            return false;
        }

        try {
            const now = new Date();
            const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            if (isNativePHP()) {
                const base64 = await blobToBase64(blob);
                const res = await fetch('/api/save-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: saveDirectoryHandle,
                        yearMonth,
                        fileName,
                        video: base64
                    })
                });
                const result = await res.json();
                return result.success === true;
            } else {
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

                const localSaveSuccess = await saveVideoLocally(blob, fileName);

                if (localSaveSuccess) {
                    setUploadQueue(prev => ({ ...prev, [targetOrderId]: { status: 'uploading', phase: 'encoding', progress: 0, blob, fileName } }));
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

    // ─────────────────────────────────────────────
    // SHOPEE VERIFICATION OVERLAY WINDOW
    // ─────────────────────────────────────────────
    if (shopeeOrder) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fade-in text-gray-900">
                {/* ขยายความมนของกรอบ Modal หน้าต่างยิงกล่องสินค้าเป็น rounded-3xl ขอบหนาข่มสายตา */}
                <div className="bg-[#eef1f8] w-full h-full max-w-7xl rounded-3xl border-2 border-slate-300 shadow-[0_25px_60px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
                    <div className="bg-white px-6 py-4 border-b-2 border-gray-200 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-sm font-black uppercase tracking-wider text-gray-600">Shopee Verification Window</span>
                        </div>
                        <button
                            onClick={() => { stopRecording(false, shopeeOrder.order_sn); setShopeeOrder(null); }}
                            className="text-gray-500 hover:text-red-600 text-base font-black transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200"
                        >
                            <X className="w-5 h-5" />
                            <span>ปิดหน้าต่าง (Esc)</span>
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

                <UploadQueuePanel queue={uploadQueue} onRetry={handleRetryUpload} onDismiss={handleDismissUpload} />
            </div>
        );
    }

    // ─────────────────────────────────────────────
    // STYLE DICTIONARY FOR UTILITY BUTTONS
    // ─────────────────────────────────────────────
    // ปรับความสูง Padding ของปุ่มเลือกโฟลเดอร์ให้ใหญ่ หนาสะใจ พนักงานใช้นิ้วโป้งจิ้มโดนแน่นอน
    const baseStyle = "flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-black transition-all duration-150 outline-none shadow-sm active:scale-[0.98]"

    const unconnectedStyle = `
        ${baseStyle}
        bg-gradient-to-r from-violet-600 to-blue-600 text-white
        hover:from-violet-700 hover:to-blue-700 hover:shadow-md
    `

    const connectedStyle = `
        ${baseStyle}
        bg-emerald-50 text-emerald-800 border-2 border-emerald-200
        hover:bg-emerald-100 hover:border-emerald-300
    `

    return (
        <div className="p-6 md:p-8 bg-[#eef1f8] min-h-screen flex flex-col gap-5 text-gray-900">
            {/* ส่วนหัวสำหรับจัดระดับปุ่มควบคุม */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                    onClick={handleSelectDirectory}
                    disabled={isPickerOpen}
                    className={`${saveDirectoryHandle ? connectedStyle : unconnectedStyle} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {saveDirectoryHandle ? (
                        <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span>เชื่อมต่อแฟ้มบันทึกแล้ว</span>
                        </>
                    ) : (
                        <>
                            <Folder className="w-5 h-5" />
                            <span>คลิกเลือกโฟลเดอร์บันทึกวิดีโอ</span>
                        </>
                    )}
                </button>
            </div>

            {/* กล่องสแกนสินค้าตัวย่อย */}
            <UniversalPackScan
                onOrderFound={(order) => setShopeeOrder(order)}
                saveDirectoryHandle={saveDirectoryHandle}
            />

            <UploadQueuePanel queue={uploadQueue} onRetry={handleRetryUpload} onDismiss={handleDismissUpload} />
        </div>
    );
}
