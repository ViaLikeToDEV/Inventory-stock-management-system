import React, { useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// ─────────────────────────────────────────────
// Types & สากล Mock Data (พร้อมต่อ Backend ระบบจริง)
// ─────────────────────────────────────────────
type MetricKey = 'box_per_day' | 'box_per_hour' | 'avg_time';
type SeriesKey = 'shopee' | 'tiktok';

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
    { value: 'box_per_day', label: 'กล่อง / วัน (Boxes / Day)' },
    { value: 'box_per_hour', label: 'กล่อง / ชม. (Boxes / Hour)' },
    { value: 'avg_time', label: 'เวลาเฉลี่ย (Average Time)' },
];

const METRIC_TITLE: Record<MetricKey, string> = {
    box_per_day: 'จำนวนกล่องต่อวัน',
    box_per_hour: 'จำนวนกล่องต่อชั่วโมง',
    avg_time: 'เวลาเฉลี่ยในการแพ็คต่อออเดอร์',
};

const MOCK_DATA: Record<MetricKey, { date: string; shopee: number; tiktok: number }[]> = {
    box_per_day: [
        { date: '2026-06-14', shopee: 12, tiktok: 10 },
        { date: '2026-06-15', shopee: 14, tiktok: 12 },
        { date: '2026-06-16', shopee: 15, tiktok: 15 },
        { date: '2026-06-17', shopee: 15, tiktok: 16 },
        { date: '2026-06-18', shopee: 18, tiktok: 17 },
        { date: '2026-06-19', shopee: 24, tiktok: 20 },
    ],
    box_per_hour: [
        { date: '2026-06-14', shopee: 1.5, tiktok: 1.2 },
        { date: '2026-06-15', shopee: 1.7, tiktok: 1.5 },
        { date: '2026-06-16', shopee: 1.9, tiktok: 1.8 },
        { date: '2026-06-17', shopee: 1.9, tiktok: 2.0 },
        { date: '2026-06-18', shopee: 2.2, tiktok: 2.1 },
        { date: '2026-06-19', shopee: 3.0, tiktok: 2.5 },
    ],
    avg_time: [
        { date: '2026-06-14', shopee: 5.4, tiktok: 6.0 },
        { date: '2026-06-15', shopee: 5.0, tiktok: 5.6 },
        { date: '2026-06-16', shopee: 4.8, tiktok: 5.0 },
        { date: '2026-06-17', shopee: 4.6, tiktok: 4.7 }, // แก้ไข typo เล็กน้อยจากโค้ดเดิม
        { date: '2026-06-18', shopee: 4.0, tiktok: 4.4 },
        { date: '2026-06-19', shopee: 3.2, tiktok: 3.8 },
    ],
};

const TOP_SELLING: Record<string, { name: string; qty: number }[]> = {
    '2026-06': [
        { name: 'ItemA', qty: 1000 },
        { name: 'ItemB', qty: 1000 },
        { name: 'ItemC', qty: 1000 },
    ],
};

// ─────────────────────────────────────────────
// Products Received chart card
// ─────────────────────────────────────────────
export function ProductsReceivedChart() {
    const [metric, setMetric] = useState<MetricKey>('box_per_day');
    const [activeSeries, setActiveSeries] = useState<SeriesKey | 'all'>('all');

    const data = MOCK_DATA[metric];

    const toggleSeries = (key: SeriesKey) => {
        setActiveSeries(prev => (prev === key ? 'all' : key));
    };

    const lineStyle = (key: SeriesKey) => ({
        strokeWidth: activeSeries === key ? 4 : activeSeries === 'all' ? 2.5 : 1.5,
        strokeOpacity: activeSeries === 'all' || activeSeries === key ? 1 : 0.25,
    });

    const formatXAxis = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        } catch (e) {
            return dateStr;
        }
    };

    const formatYAxis = (value: number) => {
        if (metric === 'box_per_day') return Math.round(value).toString();
        if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
        return value.toFixed(1);
    };

    const getYUnit = () => {
        if (metric === 'box_per_day') return 'กล่อง';
        if (metric === 'box_per_hour') return 'กล่อง/ชม.';
        if (metric === 'avg_time') return 'นาที';
        return '';
    };

    const getFullUnitLabel = () => {
        if (metric === 'box_per_day') return 'กล่อง';
        if (metric === 'box_per_hour') return 'กล่องต่อชั่วโมง';
        if (metric === 'avg_time') return 'นาทีต่อออเดอร์';
        return '';
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">
                        {METRIC_TITLE[metric]}
                    </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="packing-metric" className="text-xs font-semibold text-gray-400">
                        ตัวเลือกตัวชี้วัด:
                    </label>
                    <select
                        id="packing-metric"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value as MetricKey)}
                        className="border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 px-3 py-2 outline-none focus:border-blue-500 bg-gray-50 cursor-pointer shadow-sm"
                    >
                        {METRIC_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-center gap-6 my-4 bg-gray-50 py-2 rounded-xl border border-gray-100">
                <button
                    type="button"
                    onClick={() => toggleSeries('shopee')}
                    className={`flex items-center gap-2 text-sm font-bold transition-all ${activeSeries === 'tiktok' ? 'opacity-30 scale-95' : 'opacity-100'}`}
                >
                    <span className={`rounded-full bg-orange-500 transition-all ${activeSeries === 'shopee' ? 'w-3.5 h-3.5 ring-4 ring-orange-100' : 'w-2.5 h-2.5'}`} />
                    <span>Shopee ({getYUnit()})</span>
                </button>
                <button
                    type="button"
                    onClick={() => toggleSeries('tiktok')}
                    className={`flex items-center gap-2 text-sm font-bold transition-all ${activeSeries === 'shopee' ? 'opacity-30 scale-95' : 'opacity-100'}`}
                >
                    <span className={`rounded-full bg-black transition-all ${activeSeries === 'tiktok' ? 'w-3.5 h-3.5 ring-4 ring-gray-200' : 'w-2.5 h-2.5'}`} />
                    <span>TikTok ({getYUnit()})</span>
                </button>
            </div>

            <div className="flex-1 min-h-[260px] mt-2">
                <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="4 4" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatXAxis}
                            tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={false}
                            dy={8}
                        />
                        <YAxis
                            tickFormatter={formatYAxis}
                            tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                            dx={-8}
                        />
                        {/* 🛠️ จุดที่แก้ไข: ถอด filterBy ออกเพื่อแก้โค้ดแดง แล้วใช้ระบบจัดการผ่าน formatter แทน */}
                        <Tooltip
                            contentStyle={{
                                borderRadius: 12,
                                border: 'none',
                                fontSize: 13,
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)'
                            }}
                            labelStyle={{ fontWeight: 700, color: '#1f2937', marginBottom: 4 }}
                            formatter={(value: any, name: any, props: any) => {
                                // ดึง dataKey จากพร็อพเพอร์ตี้ที่ส่งเข้ามาพิจารณา
                                const dataKey = props.dataKey;

                                // ถ้าเลือกเจาะจงบางแพลตฟอร์ม และ dataKey ชิ้นนั้นไม่ใช่อันที่กดเลือก ให้ส่งค่ากลับเป็น null ไปซ่อนซะ
                                if (activeSeries !== 'all' && dataKey !== activeSeries) {
                                    return null;
                                }

                                // นอกเหนือจากนั้น (กรณีไม่ได้กดค้าง หรือเป็นคีย์ที่เลือก) ให้แสดงกล่องสรุปตามปกติ
                                return [`${value} ${getFullUnitLabel()}`, name];
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="shopee"
                            name="Shopee"
                            stroke="#f97316"
                            dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                            {...lineStyle('shopee')}
                        />
                        <Line
                            type="monotone"
                            dataKey="tiktok"
                            name="TikTok"
                            stroke="#111111"
                            dot={{ r: 4, fill: '#111111', strokeWidth: 0 }}
                            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                            {...lineStyle('tiktok')}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Top Selling card
// ─────────────────────────────────────────────
export function TopSellingCard() {
    const [month, setMonth] = useState('2026-06');
    const rows = TOP_SELLING[month] ?? [];

    return (
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Top Selling</h3>
                    <p className="text-xs text-gray-400 mt-0.5">สินค้าที่มียอดสั่งซื้อสูงสุด</p>
                </div>
                <div className="border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 shadow-sm">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="text-sm font-semibold text-gray-700 outline-none bg-transparent cursor-pointer"
                    />
                </div>
            </div>

            <div className="flex justify-between text-gray-500 font-bold text-sm mb-3 px-2 border-b border-gray-50 pb-2">
                <span>ชื่อสินค้า</span>
                <span>จำนวนที่ขายได้ (ชิ้น)</span>
            </div>

            <div className="flex flex-col flex-1 justify-center">
                {rows.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูลในเดือนนี้</p>
                ) : (
                    rows.map((row, idx) => (
                        <div
                            key={row.name}
                            className={`flex justify-between items-center py-4 px-2 hover:bg-gray-50/50 rounded-xl transition-colors ${idx !== rows.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <span className="text-base font-bold text-gray-800">{row.name}</span>
                            <span className="text-base font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{row.qty.toLocaleString()}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
