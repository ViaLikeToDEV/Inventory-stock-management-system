import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Video, VideoOff, Circle } from 'lucide-react';

export default function Packing() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 🔴 State สำหรับการบันทึกวิดีโอ
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0); // นับวินาที

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // 🔴 Ref สำหรับ MediaRecorder
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // 🔴 เพิ่ม audio
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("ไม่สามารถเปิดกล้องได้:", err);
            }
        };

        const stopCamera = () => {
            // 🔴 หยุดบันทึกด้วยถ้ากำลังอยู่
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

    // 🔴 ฟังก์ชันสร้างชื่อไฟล์: DD_MM_OrderID
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

    const uploadToGoogleDrive = async (
        blob: Blob,
        fileName: string
    ) => {

        const base64 = await blobToBase64(blob);

        const response = await fetch(
            "https://script.google.com/macros/s/AKfycbxghhO7jQJ06pt0235T77DwJsbI7T2XxX4iarrQQk_9ZZAdQXCFq_BlrrQc3FvawiA1Uw/exec",
            {
                method: "POST",
                mode: "cors", // 🟢 บังคับใช้โหมด cors
                headers: {
                    // 🟢 เปลี่ยนจาก application/json เป็น text/plain เพื่อเลี่ยง Preflight (CORS)
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    fileName,
                    video: base64
                })
            }
        );

        return await response.json();
    };

    // 🔴 เริ่มบันทึก
    const startRecording = () => {
        if (!streamRef.current) return;

        recordedChunksRef.current = [];

        // เลือก mimeType ที่รองรับ
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : '';

        const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {});

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunksRef.current.push(e.data);
            }
        };

        recorder.start(100); // เก็บทุก 100ms
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingTime(0);

        // เริ่มนับเวลา
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
    };

    // 🔴 หยุดบันทึก: saveFile=true → download, false → ทิ้ง
    const stopRecording = (saveFile: boolean) => {

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (
            !mediaRecorderRef.current ||
            mediaRecorderRef.current.state === 'inactive'
        ) {
            setIsRecording(false);
            setRecordingTime(0);
            return;
        }

        if (saveFile) {

            mediaRecorderRef.current.onstop = async () => {

                try {

                    const blob = new Blob(
                        recordedChunksRef.current,
                        {
                            type: 'video/webm'
                        }
                    );

                    const fileName =
                        getFileName(
                            selectedOrderId!
                        );

                    const result =
                        await uploadToGoogleDrive(
                            blob,
                            fileName
                        );

                    console.log(
                        'Upload Success',
                        result
                    );

                    alert(
                        'อัปโหลดวิดีโอสำเร็จ'
                    );

                } catch (error) {

                    console.error(
                        'Upload Error',
                        error
                    );

                    alert(
                        'อัปโหลดวิดีโอไม่สำเร็จ'
                    );
                }

                recordedChunksRef.current = [];
            };

        } else {

            mediaRecorderRef.current.onstop = () => {
                recordedChunksRef.current = [];
            };

        }

        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;

        setIsRecording(false);
        setRecordingTime(0);
    };

        // 🔴 format วินาที → MM:SS
        const formatTime = (seconds: number) => {
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        };

        if (selectedOrderId) {
            const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);

            return (
                <div className="p-8 bg-white min-h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                        {/* ฝั่งซ้าย: กล้อง + ปุ่มบันทึก */}
                        <div className="flex flex-col">
                            {/* กล่องกล้อง */}
                            <div className="bg-[#d9d9d9] aspect-[4/3] w-full relative flex items-center justify-center overflow-hidden">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover absolute inset-0"
                                />
                                {!streamRef.current && (
                                    <span className="text-gray-500 font-medium">กำลังเปิดกล้อง...</span>
                                )}

                                {/* 🔴 แสดงสถานะ REC มุมบนซ้าย */}
                                {isRecording && (
                                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full z-10">
                                        <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
                                        REC {formatTime(recordingTime)}
                                    </div>
                                )}
                            </div>

                            {/* 🔴 ปุ่มควบคุมการบันทึก */}
                            <div className="flex gap-3 mt-4">
                                {!isRecording ? (
                                    <button
                                        onClick={startRecording}
                                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-[20px] transition-colors"
                                    >
                                        <Video className="w-5 h-5" />
                                        เริ่มบันทึก
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => stopRecording(false)}
                                        className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-[20px] transition-colors"
                                    >
                                        <VideoOff className="w-5 h-5" />
                                        ยกเลิกบันทึก
                                    </button>
                                )}
                            </div>

                            {/* ปุ่มลูกศรย้อนกลับ */}
                            <button
                                onClick={() => setSelectedOrderId(null)}
                                className="mt-4 text-gray-500 hover:text-gray-800 transition-colors w-fit"
                            >
                                <ArrowLeft className="w-10 h-10" />
                            </button>
                        </div>

                        {/* ฝั่งขวา: รายละเอียด */}
                        <div className="flex flex-col">
                            <h3 className="text-2xl font-bold text-gray-900 mb-6">
                                หมายเลข order : {selectedOrderId}
                            </h3>

                            <div className="w-full mb-10">
                                <div className="grid grid-cols-4 bg-[#e2e2e2] text-gray-800 font-semibold py-2 px-2 border-b border-gray-400">
                                    <div className="col-span-3">สินค้า</div>
                                    <div className="text-right">จำนวน</div>
                                </div>

                                {currentOrderItems.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-4 items-center py-3 px-2 border-b border-gray-300 text-gray-700">
                                        <div className="col-span-3 pr-4 truncate" title={item['Product Name']}>
                                            {item['Product Name']}
                                        </div>
                                        <div className="text-right font-medium">
                                            0/{item['Quantity']}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        stopRecording(false); // ทิ้งวิดีโอ
                                        setSelectedOrderId(null);
                                    }}
                                    className="bg-[#cc0000] hover:bg-red-700 text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={() => {
                                        // 🔴 บันทึกวิดีโอแล้วค่อย save order
                                        stopRecording(true);

                                        alert('บันทึกข้อมูลเรียบร้อย!');
                                    }}
                                    className="bg-[#2b3e52] hover:bg-[#1e2d3d] text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors"
                                >
                                    บันทึก
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            );
        }

        // ==========================================
        // หน้าตาราง (เหมือนเดิม)
        // ==========================================
        const uniqueOrders = Array.from(new Set(orders.map(o => o['Order ID'])));
        const totalPages = Math.ceil(uniqueOrders.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const currentData = uniqueOrders.slice(startIndex, startIndex + itemsPerPage);

        return (
            <div className="p-8 bg-[#eef1f8] min-h-full">
                <div className="flex items-center gap-3 mb-4">
                    <label className="text-gray-600 font-medium">แสดงหน้าละ :</label>
                    <select
                        className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-700 outline-none focus:border-blue-500 shadow-sm"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
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
                                <span className="text-gray-700 font-medium px-4">
                                    หน้า {currentPage} / {totalPages || 1}
                                </span>
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
            </div>
        );
    }

