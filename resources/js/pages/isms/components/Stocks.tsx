// components/StockDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, AlertTriangle, PackageOpen, LayoutGrid, CheckCircle } from 'lucide-react';
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend
} from 'chart.js';
import { Bar as BarChart, Doughnut as DonutChart } from 'react-chartjs-2'; //  ถูกต้องimport { Bar as BarChart, Doughnut as DonutChart } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Register core elements + ปลั๊กอิน Data Labels สำหรับแสดงตัวเลขบนแท่งกราฟตรงๆ
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

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

  const active  = useMemo(() => items.filter(i => i.is_active),  [items]);
  const ghosts  = useMemo(() => items.filter(i => !i.is_active), [items]);

  // ── Unpacked Action Items (หัวใจหลักของพนักงานจัดของ) ──
  // กรองเฉพาะที่มีของค้าง unpack > 0 และเรียงจากมากไปน้อยที่สุดเพื่อดับไฟก่อน
  const unpackedActionItems = useMemo(() => {
    return active.filter(i => i.unpacked > 0).sort((a, b) => b.unpacked - a.unpacked);
  }, [active]);

  const sorted  = useMemo(() => [...active].sort((a, b) => b.total - a.total), [active]);

  const totalPacked   = items.reduce((s, i) => s + i.packed,   0);
  const totalUnpacked = items.reduce((s, i) => s + i.unpacked, 0);
  const totalAll      = items.reduce((s, i) => s + i.total,    0);
  const ghostUnits    = ghosts.reduce((s, i) => s + i.total,   0);
  const noBarcode      = active.filter(i => !i.barcode).length;
  const pct = (v: number) => totalAll > 0 ? Math.round((v / totalAll) * 100) : 0;

  // Custom CSS สำหรับ CSS Pulse Effect ของการแจ้งเตือน
  useEffect(() => {
    if (!document.getElementById('pulse-style')) {
      const style = document.createElement('style');
      style.id = 'pulse-style';
      style.innerHTML = `
        @keyframes amber-pulse {
          0%, 100% { border-color: rgba(237, 161, 0, 0.4); box-shadow: 0 0 0 0 rgba(237, 161, 0, 0.2); }
          50% { border-color: rgba(237, 161, 0, 1); box-shadow: 0 0 12px 4px rgba(237, 161, 0, 0.15); }
        }
        .pulse-amber-border { animation: amber-pulse 2s infinite ease-in-out; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-8 h-8 text-[#334d8f] animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium">{error}</span>
    </div>
  );

  // ── Horizontal Bar Configurations ──
  const barData = {
    labels: sorted.map(i => i.sku),
    datasets: [
      {
        label: 'Packed',
        data: sorted.map(i => i.packed),
        backgroundColor: BLUE,
        borderRadius: 4,
        borderSkipped: false as const,
      },
      {
        label: 'Unpacked',
        data: sorted.map(i => i.unpacked),
        backgroundColor: AMBER,
        borderRadius: 4,
        borderSkipped: false as const,
      },
    ],
  };

  const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index' as const },
      // ดึงค่ามาแปะบนแท่งชาร์ตตรงๆ พนักงานไม่ต้องเอาเมาส์มาจ่อ
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#4b5563',
        font: { weight: 'bold' as const, size: 10 },
        formatter: (value: number) => value > 0 ? value.toLocaleString() : '',
      }
    },
    scales: {
      x: {
        ticks: { color: '#898781', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.06)' },
        beginAtZero: true,
        grace: '10%' // เพิ่มพื้นที่ปลายกราฟไม่ให้ตัวเลข Data Labels หลุดขอบชาร์ต
      },
      y: {
        ticks: { color: '#374151', font: { size: 12 } },
        grid: { display: false },
      },
    },
  };

  const barHeight = Math.max(300, sorted.length * 48 + 60);

  // ── Donut Configurations ──
  const donutLabels = ['Packed', 'Unpacked', 'Ghost units'];
  const donutVals   = [totalPacked, totalUnpacked, ghostUnits];
  const donutColors = [BLUE, AMBER, RED];
  const donutTotal  = donutVals.reduce((s, v) => s + v, 0);

  const donutData = {
    labels: donutLabels,
    datasets: [{
      data: donutVals,
      backgroundColor: donutColors,
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      datalabels: { display: false } // ปิดดาต้าเลเบลในโดนัทไม่ให้รก
    },
  };

  return (
    <div className="space-y-5 mb-8 bg-gray-50/50 p-4 rounded-3xl">

      {/* ── SECTION 1: VISUAL HIGHLIGHT COMPONENT (KPIs) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* BIG HERO CARD: UNPACKED ACTION REQUIRED */}
        <div className="col-span-1 md:col-span-3 lg:col-span-2 bg-amber-50 rounded-2xl p-5 border-2 pulse-amber-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-amber-800 tracking-wide uppercase">Unpacked ค้างแพ็ค (ต้องจัดด่วน)</p>
              <PackageOpen className="w-5 h-5 text-amber-600 animate-bounce" />
            </div>
            <p className="text-4xl font-black text-amber-600 tracking-tight">
              {totalUnpacked.toLocaleString()} <span className="text-sm font-normal text-amber-700">ชิ้น</span>
            </p>
          </div>
          <p className="text-xs text-amber-700 font-medium mt-3 bg-amber-100/70 px-2.5 py-1 rounded-md inline-block self-start">
            คิดเป็น {pct(totalUnpacked)}% ของสต็อก orders ทั้งหมด
          </p>
        </div>

        {/* OTHER BANAL KPIS (SHRUNK VISUAL WEIGHT) */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-gray-400 mb-1">Packed พร้อมส่ง</p>
            <p className="text-2xl font-bold text-[#2a78d6]">{totalPacked.toLocaleString()}</p>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{pct(totalPacked)}% ของทั้งหมด</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-gray-400 mb-1">รวม Stock ทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-800">{totalAll.toLocaleString()}</p>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{active.length} Active SKU</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-red-50 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-red-500 mb-1">Ghost SKU (ไร้ระบบ)</p>
            <p className="text-2xl font-bold text-red-600">{ghostUnits.toLocaleString()}</p>
          </div>
          <p className="text-[11px] text-red-400 mt-2">{ghosts.length} SKU หลุดระบบ</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-gray-400 mb-1">SKU ไม่มี Barcode</p>
            <p className="text-2xl font-bold text-pink-600">{noBarcode.toLocaleString()}</p>
          </div>
          <p className="text-[11px] text-pink-400 mt-2">เสี่ยงหยิบผิดชิ้น</p>
        </div>
      </div>

      {/* ── SECTION 2: PRIMARY ACTION ITEM TABLE (TOP PRIORITY LAYOUT) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <PackageOpen className="w-5 h-5" />
            <div>
              <h2 className="font-bold text-base leading-none">ใบงานเตรียมสินค้า Unpacked Action Table</h2>
              <p className="text-xs text-amber-100 mt-1">รายการสินค้าที่ต้องเบิกมาแพ็ค ทยอยทำจากบนลงล่าง</p>
            </div>
          </div>
          <span className="bg-white/20 text-white font-mono text-xs font-bold px-3 py-1 rounded-full">
            ต้องเคลียร์ {unpackedActionItems.length} SKU
          </span>
        </div>

        <div className="overflow-x-auto">
          {unpackedActionItems.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <p className="font-medium text-gray-600">เยี่ยมมาก! ไม่มีสินค้า Unpacked ค้างในระบบแล้ว</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-6 py-3">ข้อมูลสินค้า / SKU</th>
                  <th className="px-6 py-3 text-center">Barcode</th>
                  <th className="px-6 py-3 text-right text-amber-600 bg-amber-50/50">ต้องเตรียม (Unpacked)</th>
                  <th className="px-6 py-3 text-right text-gray-400">แพ็คแล้ว (Packed)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unpackedActionItems.map((item, idx) => (
                  <tr key={item.sku} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-mono font-bold text-sm text-gray-900">{item.sku}</div>
                      <div className="text-xs text-gray-400 truncate max-w-md mt-0.5">
                        {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {item.barcode ? (
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.barcode}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1 justify-center w-max mx-auto">
                          <AlertTriangle className="w-3 h-3" /> ไม่มีบาร์โค้ด
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-black text-lg text-amber-600 bg-amber-50/30">
                      {item.unpacked.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-gray-400">
                      {item.packed.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── SECTION 3: CHARTS & SECONDARY INFORMATION AREA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Horizontal Bar Chart (2/3 Width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4 text-gray-400" />
              ภาพรวมจำนวนชิ้นจำแนกราย SKU
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">เรียงลำดับตาม Total สต็อกสูงสุด (Active Items เท่านั้น)</p>
          </div>
          <div className="flex gap-4 mb-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-3 h-3 rounded" style={{ background: BLUE }} /> Packed
            </span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-3 h-3 rounded" style={{ background: AMBER }} /> Unpacked
            </span>
          </div>
          <div className="flex-1" style={{ position: 'relative', height: barHeight }}>
            <BarChart data={barData} options={barOptions} />
          </div>
        </div>

        {/* Donut Chart (1/3 Width - Demoted in Hierarchy) */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">สัดส่วนภาพรวมคลัง</h3>
            <p className="text-xs text-gray-400 mt-0.5">เปอร์เซ็นต์สะสมแยกตามสถานะ</p>
          </div>

          <div className="my-6 flex justify-center">
            <div style={{ position: 'relative', height: 180, width: 180 }}>
              <DonutChart data={donutData} options={donutOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-700">{donutTotal.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">ชิ้นรวม</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-50 pt-3">
            {donutLabels.map((label, idx) => {
              const p = donutTotal > 0 ? Math.round((donutVals[idx] / donutTotal) * 100) : 0;
              return (
                <div key={label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: donutColors[idx] }} />
                    <span className="text-gray-500 font-medium">{label}</span>
                  </div>
                  <div className="font-bold text-gray-700">
                    {donutVals[idx].toLocaleString()} <span className="font-normal text-gray-400">({p}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: GHOST SKU SYSTEM ANOMALIES ── */}
      {ghosts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 border-2 border-red-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-red-700">Ghost SKU — ตรวจพบสินค้าหลุดระบบ</h3>
              <p className="text-xs text-red-400 mt-0.5">พบยอดขายเข้ามาแต่ไม่มี SKU อยู่ในระบบฐานข้อมูลหลัก ({ghosts.length} รายการ)</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-red-50">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-red-50/70 text-xs font-bold text-red-700 uppercase">
                  <th className="px-4 py-2.5">SKU code</th>
                  <th className="px-4 py-2.5 text-center">Packed</th>
                  <th className="px-4 py-2.5 text-center">Unpacked</th>
                  <th className="px-4 py-2.5 text-right">Total ชิ้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50 font-mono text-xs">
                {ghosts.map((g, i) => (
                  <tr key={i} className="hover:bg-red-50/30 text-gray-700">
                    <td className="px-4 py-2.5 font-bold text-red-700">{g.sku}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500">{g.packed}</td>
                    <td className="px-4 py-2.5 text-center text-amber-600 font-bold">{g.unpacked}</td>
                    <td className="px-4 py-2.5 text-right font-black text-red-600">{g.total}</td>
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
