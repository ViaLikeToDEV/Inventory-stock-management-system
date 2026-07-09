// components/StockDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, AlertTriangle, PackageOpen, LayoutGrid, CheckCircle } from 'lucide-react';
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend
} from 'chart.js';
import { Bar as BarChart, Doughnut as DonutChart } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  ArcElement, BarElement,
  CategoryScale, LinearScale,
  Tooltip, Legend,
  ChartDataLabels,
);

interface StockItem {
  sku: string;
  variant_name: string;
  product_name: string;
  barcode: string | null;
  is_active: boolean;
  packed: number;
  unpacked: number;
  total: number;
}

const BLUE  = '#2a78d6';
const AMBER = '#eda100';
const RED   = '#e34948';

export default function StockDashboard() {
  const [items, setItems]     = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    axios
      .post(route('shopee-required-query'))
      .then(res => setItems(res.data))
      .catch(err => setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => items.filter(i => i.is_active),  [items]);
  const ghosts = useMemo(() => items.filter(i => !i.is_active), [items]);

  const unpackedActionItems = useMemo(() => {
    return active.filter(i => i.unpacked > 0).sort((a, b) => b.unpacked - a.unpacked);
  }, [active]);

  // Sort by % unpacked descending — most urgent first
  const sorted = useMemo(() => {
    return [...active]
      .filter(i => i.total > 0)
      .sort((a, b) => (b.unpacked / b.total) - (a.unpacked / a.total));
  }, [active]);

  const totalPacked   = items.reduce((s, i) => s + i.packed,   0);
  const totalUnpacked = items.reduce((s, i) => s + i.unpacked, 0);
  const totalAll      = items.reduce((s, i) => s + i.total,    0);
  const ghostUnits    = ghosts.reduce((s, i) => s + i.total,   0);
  const noBarcode      = active.filter(i => !i.barcode).length;

  const pct = (v: number) => totalAll > 0 ? Math.round((v / totalAll) * 100) : 0;

  useEffect(() => {
    if (!document.getElementById('pulse-style')) {
      const style = document.createElement('style');
      style.id = 'pulse-style';
      style.innerHTML = `
        @keyframes amber-pulse {
          0%, 100% { border-color: rgba(237, 161, 0, 0.4); box-shadow: 0 0 0 0 rgba(237, 161, 0, 0.2); }
          50% { border-color: rgba(237, 161, 0, 1); box-shadow: 0 0 14px 6px rgba(237, 161, 0, 0.2); }
        }
        .pulse-amber-border { animation: amber-pulse 2s infinite ease-in-out; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-12 h-12 text-[#334d8f] animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-4 text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-lg">
      <AlertTriangle className="w-7 h-7 flex-shrink-0" />
      <span className="font-bold">{error}</span>
    </div>
  );

  // ── Stacked 100% Horizontal Bar ───────────────────────────────────────────
  const barLabels = sorted.map(i => i.sku);
  const packedPct  = sorted.map(i => Math.round((i.packed   / i.total) * 100));
  const unpackedPct = sorted.map(i => Math.round((i.unpacked / i.total) * 100));

  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Packed %',
        data: packedPct,
        backgroundColor: BLUE,
        borderRadius: 0,
        borderSkipped: false as const,
        stack: 'stack',
      },
      {
        label: 'Unpacked %',
        data: unpackedPct,
        backgroundColor: AMBER,
        borderRadius: 0,
        borderSkipped: false as const,
        stack: 'stack',
      },
    ],
  };

  const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 14 },
        callbacks: {
          label: (ctx: any) => {
            const item = sorted[ctx.dataIndex];
            if (ctx.datasetIndex === 0) {
              return `  Packed: ${item.packed.toLocaleString()} ชิ้น (${ctx.parsed.x}%)`;
            }
            return `  Unpacked: ${item.unpacked.toLocaleString()} ชิ้น (${ctx.parsed.x}%)`;
          },
          title: (items: any[]) => {
            const item = sorted[items[0].dataIndex];
            return `${item.sku} — รวม ${item.total.toLocaleString()} ชิ้น`;
          },
        },
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold' as const, size: 13 }, // ขยายขนาดตัวเลขในแท่งกราฟ
        formatter: (value: number) => value >= 12 ? `${value}%` : '',
        anchor: 'center' as const,
        align: 'center' as const,
      },
    },
    scales: {
      x: {
        stacked: true,
        max: 100,
        ticks: {
          color: '#4b5563',
          font: { size: 13, weight: 'bold' as const }, // ขยายสเกลเปอร์เซ็นต์ด้านล่าง
          callback: (v: any) => `${v}%`,
        },
        grid: { color: 'rgba(0,0,0,0.08)' },
      },
      y: {
        stacked: true,
        ticks: {
          color: '#1f2937',
          font: { size: 14, weight: 'bold' as const }, // ขยายชื่อ SKU ด้านซ้ายให้อ่านง่ายชัดเจน
        },
        grid: { display: false },
      },
    },
    datasets: {
      bar: {
        barPercentage:      0.75,
        categoryPercentage: 0.85,
      },
    },
  };

  // Increased height per row for touch/mobile friendly and big text
  const BAR_ROW_HEIGHT = 44;
  const barHeight = Math.max(350, sorted.length * BAR_ROW_HEIGHT + 80);

  // ── Donut Configuration ───────────────────────────────────────────────────
  const donutLabels = ['Packed', 'Unpacked', 'Ghost units'];
  const donutVals   = [totalPacked, totalUnpacked, ghostUnits];
  const donutColors = [BLUE, AMBER, RED];
  const donutTotal  = donutVals.reduce((s, v) => s + v, 0);

  const donutData = {
    labels: donutLabels,
    datasets: [{
      data: donutVals,
      backgroundColor: donutColors,
      borderWidth: 3,
      borderColor: '#ffffff',
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
  };

  return (
    <div className="font-root-reset space-y-6 mb-10 bg-white p-6 rounded-3xl text-gray-900">

      {/* ── SECTION 1: KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="col-span-1 md:col-span-3 lg:col-span-2 bg-amber-50 rounded-2xl p-6 border-2 pulse-amber-border flex flex-col justify-between">
          <div className="mb-2">
            <p className="font-extrabold text-xl text-amber-900">สินค้าที่ต้องจัดเตรียม</p>
          </div>
          <p className="text-5xl font-black text-amber-600 tracking-tight my-2">
            {totalUnpacked.toLocaleString()} <span className="text-xl font-bold text-amber-800">ชิ้น</span>
          </p>
          <p className="text-sm text-amber-900 font-bold mt-2 bg-amber-100 p-2 rounded-lg inline-block self-start">
             {pct(totalUnpacked)}% ที่ต้องถูกแพ็ค
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border-2 border-gray-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-base font-bold text-gray-500 mb-1">Packed พร้อมส่ง</p>
            <p className="text-3xl font-black text-[#2a78d6]">{totalPacked.toLocaleString()}</p>
          </div>
          <p className="text-sm font-semibold text-gray-400 mt-3">{pct(totalPacked)}% งานเสร็จสิ้น</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border-2 border-gray-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-base font-bold text-gray-500 mb-1">รวม Stock ทั้งหมด</p>
            <p className="text-3xl font-black text-gray-800">{totalAll.toLocaleString()}</p>
          </div>
          <p className="text-sm font-semibold text-gray-500 mt-3">{active.length} Active SKU</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border-2 border-red-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-base font-bold text-red-500 mb-1">SKU Undefined</p>
            <p className="text-3xl font-black text-red-600">{ghostUnits.toLocaleString()}</p>
          </div>
          <p className="text-sm font-semibold text-red-500 mt-3">{ghosts.length} SKU หลุดระบบ</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border-2 border-gray-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-base font-bold text-gray-500 mb-1">SKU ไม่มี Barcode</p>
            <p className="text-3xl font-black text-pink-600">{noBarcode.toLocaleString()}</p>
          </div>
          <p className="text-sm font-semibold text-pink-600 mt-3">พนักงานสแกนไม่ได้</p>
        </div>
      </div>

      {/* ── SECTION 2: UNPACKED ACTION TABLE ── */}
      <div className="bg-white rounded-2xl shadow-md border-2 border-amber-300 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-white">
            <PackageOpen className="w-7 h-7 flex-shrink-0" />
            <div>
              <h2 className="font-black text-xl leading-tight">ใบงานเตรียมสินค้า</h2>
              <p className="text-sm text-amber-50 mt-1 font-medium">รายการสินค้าที่ต้องเบิกมาแพ็ค ทยอยทำจากบนลงล่าง</p>
            </div>
          </div>
          <span className="bg-white text-amber-700 font-mono text-base font-black px-4 py-1.5 rounded-full shadow-sm">
            ต้องเคลียร์ {unpackedActionItems.length} SKU
          </span>
        </div>

        <div className="overflow-x-auto">
          {unpackedActionItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="font-bold text-xl text-gray-700">เยี่ยมมาก! ไม่มีสินค้า Unpacked ค้างในระบบแล้ว</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-sm font-black text-gray-700 uppercase border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-base">ข้อมูลสินค้า / SKU</th>
                  <th className="px-6 py-4 text-center text-base">Barcode</th>
                  <th className="px-6 py-4 text-right text-base text-amber-800 bg-amber-100/50">ต้องเตรียม (Unpacked)</th>
                  <th className="px-6 py-4 text-right text-base text-gray-500">แพ็คแล้ว (Packed)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unpackedActionItems.map((item) => (
                  <tr key={item.sku} className="hover:bg-amber-50/50 transition-colors">
                    <td className="px-6 py-4.5">
                      <div className="font-mono font-black text-lg text-gray-950">{item.sku}</div>
                      <div className="text-sm font-medium text-gray-600 mt-1 max-w-xl break-words">
                        {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-center whitespace-nowrap">
                      {item.barcode ? (
                        <span className="font-mono text-base font-bold bg-gray-150 text-gray-800 px-3 py-1 rounded-md border border-gray-300">
                          {item.barcode}
                        </span>
                      ) : (
                        <span className="text-sm font-black text-red-600 bg-red-100/80 px-3 py-1 rounded-md flex items-center gap-1.5 justify-center w-max mx-auto border border-red-300">
                          <AlertTriangle className="w-4 h-4" /> ไม่มีบาร์โค้ด
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4.5 text-right font-black text-2xl text-amber-600 bg-amber-50/40">
                      {item.unpacked.toLocaleString()}
                    </td>
                    <td className="px-6 py-4.5 text-right font-bold text-lg text-gray-500">
                      {item.packed.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── SECTION 3: CHARTS ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-250 flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-gray-500" />
            สัดส่วน Packed / Unpacked รายละเอียด SKU
          </h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            เรียงลำดับจาก %Unpacked มากสุด — SKU ที่ต้องเร่งแพ็คจะอยู่บนสุด (Active Items เท่านั้น)
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mb-5 text-sm font-bold">
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-4 h-4 rounded-sm" style={{ background: BLUE }} /> Packed
          </span>
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-4 h-4 rounded-sm" style={{ background: AMBER }} /> Unpacked
          </span>
        </div>

        <div style={{ position: 'relative', height: barHeight, width: '100%' }}>
          <BarChart data={barData} options={barOptions} />
        </div>
      </div>

      {/* Donut Chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-250">
        <div className="mb-5">
          <h3 className="text-lg font-black text-gray-800">สัดส่วนภาพรวมคลัง</h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">เปอร์เซ็นต์สะสมแยกตามสถานะ</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-shrink-0" style={{ position: 'relative', height: 220, width: 220 }}>
            <DonutChart data={donutData} options={donutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-gray-800">{donutTotal.toLocaleString()}</span>
              <span className="text-xs text-gray-500 font-bold tracking-wider uppercase mt-0.5">ชิ้นรวม</span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-4">
            {donutLabels.map((label, idx) => {
              const p = donutTotal > 0 ? Math.round((donutVals[idx] / donutTotal) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-sm" style={{ background: donutColors[idx] }} />
                      <span className="text-gray-700 font-bold text-base">{label}</span>
                    </div>
                    <div className="font-black text-gray-800 text-lg">
                      {donutVals[idx].toLocaleString()} <span className="font-bold text-gray-400 text-sm">({p}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p}%`, background: donutColors[idx] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: GHOST SKU ── */}
      {ghosts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6 border-2 border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500 flex-shrink-0 animate-pulse" />
            <div>
              <h3 className="text-lg font-black text-red-800">Ghost SKU — ตรวจพบสินค้าหลุดระบบ</h3>
              <p className="text-sm text-red-500 mt-0.5 font-medium">พบยอดขายเข้ามาแต่ไม่มี SKU อยู่ในระบบฐานข้อมูลหลัก ({ghosts.length} รายการ)</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border-2 border-red-50">
            <table className="w-full text-base text-left">
              <thead>
                <tr className="bg-red-50 text-sm font-black text-red-800 uppercase border-b border-red-100">
                  <th className="px-5 py-3">SKU code</th>
                  <th className="px-5 py-3 text-center">Packed</th>
                  <th className="px-5 py-3 text-center">Unpacked</th>
                  <th className="px-5 py-3 text-right">Total ชิ้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 font-mono text-sm font-bold">
                {ghosts.map((g, i) => (
                  <tr key={i} className="hover:bg-red-50/50 text-gray-800">
                    <td className="px-5 py-3.5 font-black text-base text-red-700">{g.sku}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{g.packed}</td>
                    <td className="px-5 py-3.5 text-center text-amber-600 font-black text-base">{g.unpacked}</td>
                    <td className="px-5 py-3.5 text-right font-black text-lg text-red-600">{g.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
