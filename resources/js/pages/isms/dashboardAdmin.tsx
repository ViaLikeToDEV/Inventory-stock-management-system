import React, { useRef, useState, useEffect } from 'react';
import { Home, ClipboardList, Package, Loader2, FileSearchCorner, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import Order from './order';
import Packing from './packing';
import UniversalPack from '@components/universalpack';
import Product from './product';
import { ProductsReceivedChart, TopSellingCard } from './DashboardCharts';

export function DashStat() {
    // สร้าง State มารับข้อมูลที่ดึงมา
    const [stats, setStats] = useState({
        total: 0,
        packed: 0,
        shopee: { packed: 0, total: 0 },
        tiktok: { packed: 0, total: 0 }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const response = await fetch("/getSummary", {
                    method: "POST", // ถ้า Route ของคุณเป็น GET อย่าลืมไปเปลี่ยนเป็น GET นะครับ
                    headers: { Accept: "application/json" },
                });

                const data = await response.json();
                console.log("Fetched Data:", data);

                if (!response.ok || data.status === 'error') {
                    throw new Error(data.message || 'ดึงข้อมูลสถิติไม่สำเร็จ');
                }

                // 1. ดักจับข้อมูลแยกฝั่ง ถ้าค่ายไหนไม่มี/พัง ให้กลายเป็น 0 ทันที (แอปไม่แครช)
                const shopeeTotal = data.Shopee?.total || 0;
                const shopeePacked = data.Shopee?.packed || 0;

                const tiktokTotal = data.TiktokShop?.total || 0;
                const tiktokPacked = data.TiktokShop?.packed || 0;

                // 2. เซ็ตเข้า State
                setStats({
                    shopee: { total: shopeeTotal, packed: shopeePacked },
                    tiktok: { total: tiktokTotal, packed: tiktokPacked },
                    total: shopeeTotal + tiktokTotal,
                    packed: shopeePacked + tiktokPacked
                });

            } catch (err) {
                console.error("Fetch Summary Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, []);

    // คำนวณตัวที่ยังไม่สำเร็จ
    const pendingTotal = stats.total - stats.packed;
    const pendingShopee = stats.shopee.total - stats.shopee.packed;
    const pendingTiktok = stats.tiktok.total - stats.tiktok.packed;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: ออเดอร์ทั้งหมด */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:shadow-md transition-all duration-200">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-[#0ea5e9] animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between">
                            <span className="text-xl font-bold text-gray-800">ออเดอร์ทั้งหมด</span>
                            <span className="text-5xl font-extrabold text-[#0ea5e9] tracking-tight">{stats.total}</span>
                        </div>
                        {/* ส่วนสถิติแยกฝั่งด้านล่าง */}
                        <div className="border-t border-gray-100 pt-3 flex justify-between text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                <span className="text-gray-500">Shopee:</span>
                                <span className="text-gray-800 font-bold">{stats.shopee.total}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-black"></span>
                                <span className="text-gray-500">TikTok:</span>
                                <span className="text-gray-800 font-bold">{stats.tiktok.total}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Card 2: สำเร็จแล้ว */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:shadow-md transition-all duration-200">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-[#22c55e] animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between">
                            <span className="text-xl font-bold text-gray-800">สำเร็จแล้ว</span>
                            <span className="text-5xl font-extrabold text-[#22c55e] tracking-tight">{stats.packed}</span>
                        </div>
                        {/* ส่วนสถิติแยกฝั่งด้านล่าง */}
                        <div className="border-t border-gray-100 pt-3 flex justify-between text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                <span className="text-gray-500">Shopee:</span>
                                <span className="text-gray-800 font-bold">{stats.shopee.packed}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-black"></span>
                                <span className="text-gray-500">TikTok:</span>
                                <span className="text-gray-800 font-bold">{stats.tiktok.packed}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Card 3: ยังไม่สำเร็จ */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:shadow-md transition-all duration-200">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-[#ef4444] animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between">
                            <span className="text-xl font-bold text-gray-800">ยังไม่สำเร็จ</span>
                            <span className="text-5xl font-extrabold text-[#ef4444] tracking-tight">
                                {pendingTotal > 0 ? pendingTotal : 0}
                            </span>
                        </div>
                        {/* ส่วนสถิติแยกฝั่งด้านล่าง */}
                        <div className="border-t border-gray-100 pt-3 flex justify-between text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                <span className="text-gray-500">Shopee:</span>
                                <span className="text-gray-800 font-bold">{pendingShopee > 0 ? pendingShopee : 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-black"></span>
                                <span className="text-gray-500">TikTok:</span>
                                <span className="text-gray-800 font-bold">{pendingTiktok > 0 ? pendingTiktok : 0}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeMenu, setActiveMenu] = useState('home');

    const handleSelectFile = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="flex h-screen bg-[#f4f6fb] font-sans">
            {/* Sidebar ด้านซ้าย */}
            <aside className="w-64 bg-[#1e2e40] text-white flex flex-col shadow-lg z-10">
                <div className="h-24 flex items-center justify-center border-b border-[#2a3f54]">
                    <img
                        src="/images/isms-logo.png"
                        alt="ISMS Logo"
                        className="h-full w-full object-contain p-4"
                    />
                </div>

                <nav className="flex-1 pt-6">
                    <ul className="space-y-2 px-2">
                        <li>
                            <button
                                onClick={() => setActiveMenu('home')}
                                className={`w-full flex items-center px-6 py-3 rounded-lg mx-2 transition-colors ${activeMenu === 'home' ? 'bg-[#2b3e52] text-white border-l-4 border-blue-400' : 'text-gray-300 hover:bg-[#2b3e52]'
                                    }`}
                            >
                                <Home className="w-5 h-5 mr-4" />
                                HOME
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => setActiveMenu('order')}
                                className={`w-full flex items-center px-6 py-3 rounded-lg mx-2 transition-colors ${activeMenu === 'order' ? 'bg-[#2b3e52] text-white border-l-4 border-blue-400' : 'text-gray-300 hover:bg-[#2b3e52]'
                                    }`}
                            >
                                <ClipboardList className="w-5 h-5 mr-4" />
                                Order
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => setActiveMenu('product')}
                                className={`w-full flex items-center px-6 py-3 rounded-lg mx-2 transition-colors ${activeMenu === 'product' ? 'bg-[#2b3e52] text-white border-l-4 border-blue-400' : 'text-gray-300 hover:bg-[#2b3e52]'
                                    }`}
                            >
                                <Package className="w-5 h-5 mr-4" />
                                Product
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => setActiveMenu('universal_pack')}
                                className={`w-full flex items-center px-6 py-3 rounded-lg mx-2 transition-colors ${activeMenu === 'universal_pack' ? 'bg-[#2b3e52] text-white border-l-4 border-blue-400' : 'text-gray-300 hover:bg-[#2b3e52]'
                                    }`}
                            >
                                <FileSearchCorner className="w-5 h-5 mr-4" />
                                UniversalPack
                            </button>
                        </li>
                    </ul>
                </nav>
            </aside>

            {/* พื้นที่เนื้อหาหลักด้านขวา */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* แถบสีน้ำเงินด้านบนสุด */}
                <div className="h-8 bg-[#334d8f] w-full shadow-sm"></div>

                {/* พื้นที่ Content ที่จะสลับหน้าจอ */}
                <div className="flex-1 overflow-y-auto">

                    {/* 🟢 หน้าแรก Home / Dashboard */}
                    {activeMenu === 'home' && (
                        <div className="flex flex-col h-full">
                            {/* ส่วนหัวและตัวเลขสถิติ + ปุ่มอัปโหลด CSV */}
                            <div className="p-8 pb-10 bg-[#eef1f8]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                    <div>
                                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h2>
                                    </div>

                                    {/* ปุ่มอัปโหลด CSV แบบใหม่ขนาดกะทัดรัด สวยงามลงตัว */}
                                    <button
                                        onClick={handleSelectFile}
                                        className="flex items-center justify-center gap-2.5 bg-[#334d8f] hover:bg-[#25396b] text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 px-6 py-3.5 text-base self-end sm:self-auto shrink-0 transform"
                                    >
                                        <Plus className="w-5 h-5" />
                                        CSV File
                                    </button>
                                </div>

                                {/* ส่วนการ์ดสถิติแสดงผล 3 บล็อกเต็มแถว */}
                                <div className="w-full">
                                    <DashStat />
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".csv,.xlsx,.xls"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        const formData = new FormData();
                                        formData.append("file", file);
                                        e.target.value = '';

                                        try {
                                            Swal.fire({
                                                title: 'Uploading...',
                                                allowOutsideClick: false,
                                                didOpen: () => Swal.showLoading()
                                            });

                                            const response = await fetch("/upload-orders", {
                                                method: "POST",
                                                body: formData,
                                                headers: { Accept: "application/json" },
                                            });

                                            const data = await response.json();
                                            const sheetType = data.sheetType;

                                            if (!response.ok || data.status === 'error') {
                                                throw new Error(data.message || 'Upload failed');
                                            }

                                            console.log(data);
                                            Swal.fire({
                                                icon: "success",
                                                title: `${sheetType || 'unknown'}`,
                                                text: `\n เพิ่มแล้ว: ${data.sheet_result?.inserted || 0} \n ข้อมูลซ้ำ: ${data.sheet_result?.skipped || 0}`
                                            });

                                        } catch (err: any) {
                                            if (err.response && err.response.status === 400) {
                                                Swal.fire({
                                                    icon: 'error',
                                                    title: 'Upload Validator',
                                                    text: err.response.data.message,
                                                    confirmButtonColor: '#d33'
                                                });
                                            } else {
                                                Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
                                            }
                                        }
                                    }}
                                />
                            </div>

                            {/* 🟢 แถวกราฟ Products Received + Top Selling */}
                            <div className="bg-[#f7f5fb] flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ProductsReceivedChart />
                                <TopSellingCard />
                            </div>
                        </div>
                    )}

                    {/* 🟢 แผงหน้าจอ Order */}
                    {activeMenu === 'order' && (
                        <div className="p-8 bg-[#eef1f8] min-h-full">
                            <h2 className="text-3xl font-bold text-gray-800 mb-8">Order History</h2>
                            <Order />
                        </div>
                    )}

                    {/* 🟢 แผงหน้าจอ Product */}
                    {activeMenu === 'product' && (
                        <div className="p-8 bg-[#eef1f8] min-h-full">
                            <h2 className="text-3xl font-bold text-gray-800 mb-8">Product Management</h2>
                            <Product />
                        </div>
                    )}

                    {/* 🟢 แผงหน้าจอ Universal Pack */}
                    {activeMenu === 'universal_pack' && (
                        <div className="p-8 bg-[#eef1f8] min-h-full">
                            <UniversalPack />
                        </div>
                    )}

                    {/* 🟢 แผงหน้าจอ Packing (ซ่อนไว้สำหรับเลือกใช้ภายหลัง) */}
                    {activeMenu === 'packing' && (
                        <div className="p-8 bg-[#eef1f8] min-h-full">
                            <h2 className="text-3xl font-bold text-gray-800 mb-8">Packing System</h2>
                            <Packing />
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
