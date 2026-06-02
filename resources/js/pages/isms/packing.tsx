import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
<<<<<<< HEAD
import Swal from 'sweetalert2'; // 🟢 ดึง Swal มาใช้แจ้งเตือนตอนสแกน
=======

>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef

export default function Packing() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

<<<<<<< HEAD
    // State ควบคุมการสลับหน้า
=======
    // State ควบคุมการสลับหน้า (ถ้าเป็น null คือหน้าตาราง, ถ้ามีเลข Order คือหน้ากล้อง)
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    // State สำหรับทำ Pagination (แบ่งหน้า)
    const [currentPage, setCurrentPage] = useState(1);
<<<<<<< HEAD
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // ==========================================
    // 🟢 Refs & States สำหรับ กล้อง, อัดคลิป, และ สแกนบาร์โค้ด
    // ==========================================
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const [scannedItems, setScannedItems] = useState<Record<string, number>>({});

    // 🟢 ฐานข้อมูลจำลอง (เดี๋ยวค่อยเชื่อมทีหลัง)
    const mockBarcodeDB: Record<string, string> = {
        "1111": "ผงปรุงสามเกลอรสไก่ ตราอีทสิไทย 40 กรัม (Chicken flavors Seasoning Powder mixed with Freeze Dried Grinded Garlic and Pepper Brand EATSITHAI 40g.)",
        "2222": "Yueadpao",
    };

    // ดึงข้อมูลออเดอร์ตอนโหลดหน้า
=======
    const [itemsPerPage, setItemsPerPage] = useState(10); // ค่าเริ่มต้น 10 แถว

    // Ref สำหรับเปิดกล้อง
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // ดึงข้อมูลตอนโหลดหน้า
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
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

<<<<<<< HEAD
    // คุมการเปิด-ปิดกล้อง และ Focus ช่องสแกน
=======
    // คุมการเปิด-ปิดกล้อง
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("ไม่สามารถเปิดกล้องได้:", err);
            }
        };

        const stopCamera = () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };

        if (selectedOrderId) {
<<<<<<< HEAD
            startCamera();
            setScannedItems({}); // เคลียร์ของที่สแกนเมื่อเข้าออเดอร์ใหม่
            setIsRecording(false);
            // บังคับ Focus ช่องสแกนทันที
            setTimeout(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            }, 100);
        } else {
            stopCamera();
=======
            startCamera(); // เปิดกล้องเมื่อกดเข้ามาหน้านี้
        } else {
            stopCamera(); // ปิดกล้องเมื่อกดยกเลิก
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
        }

        return () => stopCamera();
    }, [selectedOrderId]);

    // ==========================================
<<<<<<< HEAD
    // 🟢 ฟังก์ชันจัดการการสแกนบาร์โค้ด
    // ==========================================
    const handleScanBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const barcode = e.currentTarget.value.trim();
            e.currentTarget.value = ''; // ล้างช่องรอสแกนชิ้นต่อไป

            if (!barcode) return;

            const productName = mockBarcodeDB[barcode];

            if (!productName) {
                Swal.fire({ icon: 'error', title: 'ไม่พบสินค้า', text: `บาร์โค้ด ${barcode} ไม่มีในระบบ`, timer: 1500 });
                return;
            }

            const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);
            const itemInOrder = currentOrderItems.find(item => String(item['Product Name']).includes(productName));

            if (!itemInOrder) {
                Swal.fire({ icon: 'warning', title: 'หยิบผิด!', text: 'สินค้านี้ไม่ได้อยู่ในออเดอร์นี้', timer: 1500 });
                return;
            }

            const requiredQty = Number(itemInOrder['Quantity']);
            const currentScannedQty = scannedItems[itemInOrder['Product Name']] || 0;

            if (currentScannedQty >= requiredQty) {
                Swal.fire({ icon: 'info', title: 'ครบแล้ว', text: 'สินค้านี้สแกนครบแล้ว', timer: 1500 });
                return;
            }

            setScannedItems(prev => ({
                ...prev,
                [itemInOrder['Product Name']]: currentScannedQty + 1
            }));
        }
    };

    const keepFocus = () => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    // ==========================================
    // 🟢 ฟังก์ชันอัดวิดีโอ
    // ==========================================
    const startRecording = () => {
        if (!streamRef.current) return;
        chunksRef.current = [];
        const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Packing_${selectedOrderId}.webm`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
    };

    const handleSave = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
        Swal.fire('สำเร็จ!', `บันทึกวิดีโอออเดอร์ ${selectedOrderId} ลงเครื่องแล้ว`, 'success');
        setSelectedOrderId(null);
    };

    // ==========================================
    // 🔴 ถัากดปุ่มแล้ว -> โชว์หน้า "เปิดกล้อง"
=======
    // 🔴 ถัากดปุ่มแล้ว (selectedOrderId มีค่า) -> โชว์หน้า "เปิดกล้อง"
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
    // ==========================================
    if (selectedOrderId) {
        const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);

<<<<<<< HEAD
        // เช็คว่าสแกนครบหรือยัง
        const isAllPacked = currentOrderItems.every(item => {
            return (scannedItems[item['Product Name']] || 0) >= Number(item['Quantity']);
        });

        return (
            <div className="p-8 bg-[#eef1f8] min-h-full" onClick={keepFocus}>
                <div className="bg-white shadow-sm rounded-2xl p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">

                    {/* ฝั่งซ้าย: กล้อง */}
                    <div className="flex flex-col">
                        <div className="bg-gray-900 aspect-[4/3] w-full relative flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover absolute inset-0" />
                            {!streamRef.current && <span className="text-gray-400 font-medium">กำลังเปิดกล้อง...</span>}

                            {/* จุดแดง REC */}
                            {isRecording && (
                                <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                    <span className="text-white text-sm font-bold tracking-wider">REC</span>
                                </div>
                            )}
                        </div>

                        <button onClick={() => setSelectedOrderId(null)} className="mt-6 text-gray-500 hover:text-gray-800 transition-colors w-fit">
=======
        return (
            <div className="p-8 bg-white min-h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                    {/* ฝั่งซ้าย: พื้นที่กล้อง และ ปุ่มลูกศรย้อนกลับ */}
                    <div className="flex flex-col">
                        {/* กล่องสีเทาแสดงกล้อง */}
                        <div className="bg-[#d9d9d9] aspect-[4/3] w-full relative flex items-center justify-center">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover absolute inset-0"
                            />
                            {!streamRef.current && <span className="text-gray-500 font-medium">กำลังเปิดกล้อง...</span>}
                        </div>

                        {/* ปุ่มลูกศร */}
                        <button
                            onClick={() => setSelectedOrderId(null)}
                            className="mt-6 text-gray-500 hover:text-gray-800 transition-colors w-fit"
                        >
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                            <ArrowLeft className="w-10 h-10" />
                        </button>
                    </div>

<<<<<<< HEAD
                    {/* ฝั่งขวา: รายละเอียด & สแกน */}
                    <div className="flex flex-col">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">
                            หมายเลข order : {selectedOrderId}
                        </h3>

                        {/* ช่องรับบาร์โค้ด */}
                        <div className="mb-6">
                            <input
                                type="text"
                                ref={barcodeInputRef}
                                onKeyDown={handleScanBarcode}
                                placeholder="สแกนบาร์โค้ดสินค้าที่นี่..."
                                className="w-full border-2 border-blue-400 bg-blue-50 text-blue-900 text-lg rounded-xl px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-blue-300"
                            />
                        </div>

                        {/* ตารางสินค้า */}
                        <div className="w-full mb-10 border border-gray-200 rounded-xl overflow-hidden">
                            <div className="grid grid-cols-4 bg-[#f8fafc] text-gray-600 font-bold py-3 px-4 border-b border-gray-200 text-sm uppercase tracking-wider">
=======
                    {/* ฝั่งขวา: รายละเอียดออเดอร์ */}
                    <div className="flex flex-col">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">
                            หมายเลข order :{selectedOrderId}
                        </h3>

                        {/* ตารางสินค้า */}
                        <div className="w-full mb-10">
                            <div className="grid grid-cols-4 bg-[#e2e2e2] text-gray-800 font-semibold py-2 px-2 border-b border-gray-400">
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                                <div className="col-span-3">สินค้า</div>
                                <div className="text-right">จำนวน</div>
                            </div>

<<<<<<< HEAD
                            {currentOrderItems.map((item, idx) => {
                                const required = Number(item['Quantity']);
                                const scanned = scannedItems[item['Product Name']] || 0;
                                const isComplete = scanned >= required;

                                return (
                                    <div key={idx} className={`grid grid-cols-4 items-center py-4 px-4 border-b border-gray-100 transition-colors ${isComplete ? 'bg-green-50 text-green-900' : 'text-gray-700'}`}>
                                        <div className="col-span-3 pr-4 truncate font-medium" title={item['Product Name']}>
                                            {item['Product Name']}
                                        </div>
                                        <div className={`text-right font-bold text-lg ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                                            {scanned}/{required}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ปุ่มกด */}
                        <div className="flex gap-4 mt-auto">
                            {!isRecording ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); startRecording(); }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-10 rounded-xl text-lg transition-colors flex-1 shadow-lg shadow-red-200"
                                >
                                    เริ่มบันทึกวิดีโอ
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedOrderId(null); }}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-8 rounded-xl text-lg transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        disabled={!isAllPacked}
                                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                        className={`font-bold py-3 px-8 rounded-xl text-lg transition-all flex-1 shadow-lg ${
                                            isAllPacked
                                            ? 'bg-[#1e2e40] hover:bg-[#0f172a] text-white shadow-slate-300'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                        }`}
                                    >
                                        {isAllPacked ? 'บันทึกและเสร็จสิ้น' : 'สแกนให้ครบเพื่อบันทึก'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
=======
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

                        {/* ปุ่มกด */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setSelectedOrderId(null)}
                                className="bg-[#cc0000] hover:bg-red-700 text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => alert('เตรียมทำระบบบันทึกต่อไป!')}
                                className="bg-[#2b3e52] hover:bg-[#1e2d3d] text-white font-bold py-2 px-10 rounded-[20px] text-lg transition-colors"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>

>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                </div>
            </div>
        );
    }

    // ==========================================
<<<<<<< HEAD
    // 🔵 ถ้ายังไม่กดปุ่ม -> โชว์หน้า "ตารางหลัก" (เหมือนเดิมเป๊ะ)
    // ==========================================
    const uniqueOrders = Array.from(new Set(orders.map(o => o['Order ID'])));
    const totalPages = Math.ceil(uniqueOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = uniqueOrders.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="p-8 bg-[#eef1f8] min-h-full">
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                    <label className="text-gray-500 font-medium text-sm">แสดงหน้าละ :</label>
                    <select
                        className="bg-transparent text-gray-800 font-bold outline-none cursor-pointer"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
=======
    // 🔵 ถ้ายังไม่กดปุ่ม (ค่าเริ่มต้น) -> โชว์หน้า "ตาราง"
    // ==========================================
    const uniqueOrders = Array.from(new Set(orders.map(o => o['Order ID'])));

    // คำนวณข้อมูลที่จะโชว์ในหน้านั้นๆ
    const totalPages = Math.ceil(uniqueOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = uniqueOrders.slice(startIndex, startIndex + itemsPerPage)

    return (
        <div className="p-8 bg-[#eef1f8] min-h-full">

            {/* 🟢 แถบด้านบน: หัวข้อ + Dropdown เลือกจำนวนหน้า */}



                <div className="flex items-center gap-3">
                    <label className="text-gray-600 font-medium">แสดงหน้าละ :</label>
                    <select
                        className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-gray-700 outline-none focus:border-blue-500 shadow-sm"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1); // พอเปลี่ยนจำนวนปุ๊บ ให้เด้งกลับไปหน้า 1 ใหม่
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                        }}
                    >
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
                </div>

<<<<<<< HEAD
            <div className="w-full bg-white shadow-sm rounded-2xl overflow-hidden flex flex-col border border-gray-100">
                <div className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 bg-[#f8fafc] text-gray-600 font-bold py-4 px-8 border-b border-gray-200 text-sm uppercase tracking-wider">
=======

            <div className="w-full bg-white shadow-sm rounded-lg overflow-hidden flex flex-col">
                {/* หัวตาราง */}
                <div className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 bg-[#e2e2e2] text-gray-800 font-semibold py-4 px-8 border-b border-gray-300">
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                    <div>หมายเลขคำสั่งซื้อ</div>
                    <div>สินค้า</div>
                    <div className="text-center">จำนวน</div>
                    <div className="text-right">สถานะ</div>
                </div>

<<<<<<< HEAD
                <div className="bg-white flex-1">
                    {loading ? (
                        <div className="text-center py-16 text-gray-400 font-medium animate-pulse">กำลังโหลดข้อมูล...</div>
                    ) : uniqueOrders.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 font-medium">ไม่พบข้อมูลออเดอร์</div>
                    ) : (
=======
                {/* ข้อมูลในตาราง */}
                <div className="bg-white flex-1">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">กำลังดึงข้อมูล...</div>
                    ) : uniqueOrders.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">ไม่พบข้อมูลคำสั่งซื้อ</div>
                    ) : (
                        // 🟢 วนลูปโชว์เฉพาะข้อมูลที่โดนตัดมาแล้ว (currentData)
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                        currentData.map((uniqueId: any, index) => {
                            const orderInfo = orders.find(o => o['Order ID'] === uniqueId);
                            const totalQty = orders.filter(o => o['Order ID'] === uniqueId).reduce((sum, item) => sum + Number(item['Quantity']), 0);
                            const hasMoreItems = orders.filter(o => o['Order ID'] === uniqueId).length > 1;

                            return (
<<<<<<< HEAD
                                <div key={index} className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 items-center py-5 px-8 border-b border-gray-50 hover:bg-blue-50/50 transition-colors text-gray-700">
                                    <div className="truncate font-medium text-gray-900" title={orderInfo['Order ID']}>{orderInfo['Order ID']}</div>
                                    <div className="truncate text-gray-600" title={orderInfo['Product Name']}>
                                        {orderInfo['Product Name']} {hasMoreItems ? <span className="text-blue-400 text-xs ml-1">(+ อื่นๆ)</span> : ''}
                                    </div>
                                    <div className="text-center text-lg font-bold text-blue-600">{totalQty}</div>
                                    <div className="text-right flex justify-end">
                                        {orderInfo['IsPacked'] == 0 ? (
                                            <button
                                                className="bg-amber-400 hover:bg-amber-500 text-white px-8 py-2.5 rounded-full font-bold shadow-sm shadow-amber-200 transition-all hover:-translate-y-0.5"
=======
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
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                                                onClick={() => setSelectedOrderId(orderInfo['Order ID'])}
                                            >
                                                เริ่มทำงาน
                                            </button>
                                        ) : (
<<<<<<< HEAD
                                            <span className="text-emerald-600 font-bold px-6 py-2 bg-emerald-50 rounded-full text-sm">แพ็คเสร็จแล้ว</span>
=======
                                            <span className="text-green-600 font-bold px-6 py-2 bg-green-50 rounded">แพ็คเสร็จแล้ว</span>
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

<<<<<<< HEAD
                {!loading && uniqueOrders.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-100 bg-white px-8 py-5">
                        <div className="text-sm text-gray-500 font-medium">
                            แสดง {startIndex + 1} ถึง {Math.min(startIndex + itemsPerPage, uniqueOrders.length)} จากทั้งหมด {uniqueOrders.length}
=======
                {/* 🟢 แถบเครื่องมือเปลี่ยนหน้า (Pagination) ด้านล่างสุดของตาราง */}
                {!loading && uniqueOrders.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-8 py-4">
                        <div className="text-sm text-gray-600">
                            แสดง {startIndex + 1} ถึง {Math.min(startIndex + itemsPerPage, uniqueOrders.length)} จากทั้งหมด {uniqueOrders.length} รายการ
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
<<<<<<< HEAD
                                className={`p-2 rounded-lg flex items-center transition-all ${currentPage === 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-gray-800 font-bold px-4 bg-gray-50 py-1.5 rounded-lg border border-gray-100">
                                {currentPage} <span className="text-gray-400 font-normal mx-1">/</span> {totalPages || 1}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className={`p-2 rounded-lg flex items-center transition-all ${currentPage === totalPages || totalPages === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <ChevronRight className="w-5 h-5" />
=======
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
>>>>>>> dbd0e28c8b4a5a387d31bc1497ca81eab8d966ef
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
