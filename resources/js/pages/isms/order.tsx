import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    ShoppingBag,
    CalendarDays,
    Loader2,
    Package,
    CheckCircle2,
    Clock,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Platform = 'tiktok' | 'shopee';
type OrderStatus = 'done' | 'pending';
type SortKey = 'date' | 'orderNo' | 'status';
type SortDir = 'asc' | 'desc';

interface OrderItem {
    name: string;
    code: string; // หมายเลขสินค้า (SKU / บาร์โค้ด)
    qty: number;
}

interface Order {
    id: string;
    date: string; // ISO yyyy-mm-dd ใช้สำหรับ sort
    dateDisplay: string; // ข้อความที่ใช้แสดงผลและค้นหา
    month: string; // yyyy-MM
    orderNo: string;
    platform: Platform;
    status: OrderStatus;
    items: OrderItem[];
}

// ─────────────────────────────────────────────
// Small presentational helper
// ─────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />;
    return dir === 'asc'
        ? <ArrowUp className="w-3.5 h-3.5 text-[#2b3e52]" />
        : <ArrowDown className="w-3.5 h-3.5 text-[#2b3e52]" />;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function Order() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const [platform, setPlatform] = useState<Platform>('tiktok');
    const [month, setMonth] = useState<string>(''); // yyyy-MM, ว่าง = ยังไม่เลือก
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });

    // 🟢 ดึงประวัติคำสั่งซื้อจาก backend
    // TODO: เปลี่ยน '/get-order-history' ให้ตรงกับ endpoint จริงของระบบคุณ
    useEffect(() => {
        fetch('/get-order-history', { headers: { Accept: 'application/json' } })
            .then(res => res.json())
            .then(data => {
                setOrders(data?.data && data.data.length > 0 ? data.data : []);
            })
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    }, []);

    const handleSort = (key: SortKey) => {
        setSort(prev =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'asc' }
        );
    };

    // 🟢 กรองตามแพลตฟอร์ม + เดือน-ปี, ค้นหาเฉพาะ "วันที่" และ "หมายเลขสินค้า", แล้วเรียงลำดับ
    const filteredOrders = useMemo(() => {
        if (!month) return [];

        let rows = orders.filter(o => o.month === month && o.platform === platform);

        const term = search.trim().toLowerCase();
        if (term) {
            rows = rows.filter(o =>
                o.dateDisplay.toLowerCase().includes(term) ||
                o.date.toLowerCase().includes(term) ||
                o.items.some(it => it.code.toLowerCase().includes(term))
            );
        }

        const mult = sort.dir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            const av = sort.key === 'date' ? a.date : sort.key === 'orderNo' ? a.orderNo : a.status;
            const bv = sort.key === 'date' ? b.date : sort.key === 'orderNo' ? b.orderNo : b.status;
            if (av < bv) return -1 * mult;
            if (av > bv) return 1 * mult;
            return 0;
        });
    }, [orders, month, platform, search, sort]);

    return (
        <div className="bg-transparent h-full relative">
            {/* Toolbar: platform toggle + เดือน-ปี */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex bg-gray-100 p-1.5 rounded-xl w-fit gap-1">
                    <button
                        onClick={() => setPlatform('tiktok')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${platform === 'tiktok' ? 'bg-[#2b3e52] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <ShoppingBag className="w-4 h-4" /> TikTok
                    </button>
                    <button
                        onClick={() => setPlatform('shopee')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${platform === 'shopee' ? 'bg-[#ee4d2d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <ShoppingBag className="w-4 h-4" /> Shopee
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-2.5">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="text-sm text-gray-700 outline-none bg-transparent"
                    />
                </div>
            </div>

            {/* ค้นหา: เฉพาะ วันที่ และ หมายเลขสินค้า */}
            <div className="relative mb-6">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาด้วยวันที่ หรือ หมายเลขคำสั่งซื้อ..."
                    className="w-full bg-white border border-gray-200 shadow-sm rounded-xl pl-12 pr-4 py-3 text-gray-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
            </div>

            {/* ตาราง */}
            <div className="w-full bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-[#f8fafc] text-gray-600 uppercase text-xs tracking-wider border-b border-gray-200">
                                <th className="text-center font-bold py-4 px-4 w-16">ลำดับ</th>
                                <th
                                    onClick={() => handleSort('date')}
                                    className="text-left font-bold py-4 px-4 cursor-pointer select-none hover:text-gray-900 transition-colors w-[140px]"
                                >
                                    <span className="flex items-center gap-1.5">วันที่ <SortIcon active={sort.key === 'date'} dir={sort.dir} /></span>
                                </th>
                                <th
                                    onClick={() => handleSort('orderNo')}
                                    className="text-left font-bold py-4 px-4 cursor-pointer select-none hover:text-gray-900 transition-colors w-[220px]"
                                >
                                    <span className="flex items-center gap-1.5">หมายเลขคำสั่งซื้อ <SortIcon active={sort.key === 'orderNo'} dir={sort.dir} /></span>
                                </th>
                                <th className="text-left font-bold py-4 px-4 min-w-[260px]">สินค้า</th>
                                <th className="text-center font-bold py-4 px-4 w-20">จำนวน</th>
                                <th
                                    onClick={() => handleSort('status')}
                                    className="text-center font-bold py-4 px-4 cursor-pointer select-none hover:text-gray-900 transition-colors w-[160px]"
                                >
                                    <span className="flex items-center justify-center gap-1.5">สถานะ <SortIcon active={sort.key === 'status'} dir={sort.dir} /></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500 bg-white">
                                        <Loader2 className="w-8 h-8 animate-spin inline-block mb-3 text-blue-500" />
                                        <p className="font-medium">กำลังดึงข้อมูล...</p>
                                    </td>
                                </tr>
                            ) : !month ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500 bg-white">
                                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <CalendarDays className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium">กรุณาเลือกเดือน-ปี เพื่อดูประวัติคำสั่งซื้อ</p>
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500 bg-white">
                                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Package className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium">ไม่พบคำสั่งซื้อตามเงื่อนไขที่เลือก</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order, idx) => (
                                    <tr
                                        key={order.id}
                                        className="text-gray-700 text-sm hover:bg-blue-50/50 transition-colors border-b border-gray-100"
                                    >
                                        <td className="text-center py-4 px-4 font-bold text-gray-400">{idx + 1}</td>
                                        <td className="py-4 px-4 font-medium text-gray-900 whitespace-nowrap">{order.dateDisplay}</td>
                                        <td className="py-4 px-4 font-mono font-semibold text-gray-900">{order.orderNo}</td>
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col gap-1.5">
                                                {order.items.map((it, i) => (
                                                    <div key={i} className="leading-tight">
                                                        {it.name}{' '}
                                                        <span className="text-gray-400 text-[11px] font-mono">({it.code})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col gap-1.5 items-center">
                                                {order.items.map((it, i) => (
                                                    <div key={i} className="font-bold text-gray-900">{it.qty}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {order.status === 'done' ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold px-3 py-1.5 bg-emerald-50 rounded-full text-xs">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> สำเร็จ
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-amber-700 font-bold px-3 py-1.5 bg-amber-50 rounded-full text-xs">
                                                    <Clock className="w-3.5 h-3.5" /> รอดำเนินการ
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
