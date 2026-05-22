import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';


export default function Packing() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // State ควบคุมการสลับหน้า (ถ้าเป็น null คือหน้าตาราง, ถ้ามีเลข Order คือหน้ากล้อง)
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    // State สำหรับทำ Pagination (แบ่งหน้า)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // ค่าเริ่มต้น 10 แถว

    // Ref สำหรับเปิดกล้อง
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // ดึงข้อมูลตอนโหลดหน้า
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

    // คุมการเปิด-ปิดกล้อง
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
            startCamera(); // เปิดกล้องเมื่อกดเข้ามาหน้านี้
        } else {
            stopCamera(); // ปิดกล้องเมื่อกดยกเลิก
        }

        return () => stopCamera();
    }, [selectedOrderId]);

    // ==========================================
    // 🔴 ถัากดปุ่มแล้ว (selectedOrderId มีค่า) -> โชว์หน้า "เปิดกล้อง"
    // ==========================================
    if (selectedOrderId) {
        const currentOrderItems = orders.filter(o => o['Order ID'] === selectedOrderId);

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
                            <ArrowLeft className="w-10 h-10" />
                        </button>
                    </div>

                    {/* ฝั่งขวา: รายละเอียดออเดอร์ */}
                    <div className="flex flex-col">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">
                            หมายเลข order :{selectedOrderId}
                        </h3>

                        {/* ตารางสินค้า */}
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

                </div>
            </div>
        );
    }

    // ==========================================
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
                        }}
                    >
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
                </div>


            <div className="w-full bg-white shadow-sm rounded-lg overflow-hidden flex flex-col">
                {/* หัวตาราง */}
                <div className="grid grid-cols-[1.5fr_3fr_1fr_1.5fr] gap-4 bg-[#e2e2e2] text-gray-800 font-semibold py-4 px-8 border-b border-gray-300">
                    <div>หมายเลขคำสั่งซื้อ</div>
                    <div>สินค้า</div>
                    <div className="text-center">จำนวน</div>
                    <div className="text-right">สถานะ</div>
                </div>

                {/* ข้อมูลในตาราง */}
                <div className="bg-white flex-1">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">กำลังดึงข้อมูล...</div>
                    ) : uniqueOrders.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">ไม่พบข้อมูลคำสั่งซื้อ</div>
                    ) : (
                        // 🟢 วนลูปโชว์เฉพาะข้อมูลที่โดนตัดมาแล้ว (currentData)
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

                {/* 🟢 แถบเครื่องมือเปลี่ยนหน้า (Pagination) ด้านล่างสุดของตาราง */}
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
