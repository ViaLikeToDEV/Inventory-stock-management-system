import React, { useRef, useState, useEffect } from 'react';
import { Home, ClipboardList, Package, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export function DashStat() {
  // สร้าง State มารับข้อมูลที่ดึงมา
  const [stats, setStats] = useState({ total: 0, packed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ต้องเอาการ Fetch มาใส่ใน useEffect เพื่อให้มันทำแค่ตอน Component โหลดครั้งแรก!
    const fetchSummary = async () => {
      try {
        // แนะนำให้ยิงไปที่ /api/getSummary นะ ถ้าแกใช้ Laravel API routes
        const response = await fetch("/getSummary", {
          method: "POST", // ถ้า Route แกเป็น GET ก็แก้ตรงนี้นะ
          headers: { Accept: "application/json" },
        });

        const data = await response.json();

        console.log(data)

        if (!response.ok || data.status === 'error') {
          throw new Error(data.message || 'ดึงข้อมูลสถิติไม่สำเร็จ');
        }

        // อัปเดต State ด้วยข้อมูลจากหลังบ้าน
        setStats({
          total: data.total || 0,
          packed: data.packed || 0
        });
      } catch (err: any) {
        console.error("Fetch Summary Error:", err);
        // ไม่ต้องเด้ง Swal แจ้ง Error ก็ได้เดี๋ยว User รำคาญ โชว์ 0 ไปก่อน
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []); // Array ว่างแปลว่าให้รันแค่ครั้งเดียวตอนเมาท์

  // คำนวณตัวที่ยังไม่สำเร็จ
  const pending = stats.total - stats.packed;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Card 1: ออเดอร์ทั้งหมด */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center h-40 relative overflow-hidden">
        {loading ? (
          <Loader2 className="w-10 h-10 text-[#0ea5e9] animate-spin" />
        ) : (
          <>
            <span className="text-6xl font-bold text-[#0ea5e9] mb-3 transition-all">{stats.total}</span>
            <span className="text-xl font-bold text-gray-800">ออเดอร์ทั้งหมด</span>
          </>
        )}
      </div>

      {/* Card 2: สำเร็จแล้ว */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center h-40">
        {loading ? (
          <Loader2 className="w-10 h-10 text-[#22c55e] animate-spin" />
        ) : (
          <>
            <span className="text-6xl font-bold text-[#22c55e] mb-3 transition-all">{stats.packed}</span>
            <span className="text-xl font-bold text-gray-800">สำเร็จแล้ว</span>
          </>
        )}
      </div>

      {/* Card 3: ยังไม่สำเร็จ */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center h-40">
        {loading ? (
          <Loader2 className="w-10 h-10 text-[#ef4444] animate-spin" />
        ) : (
          <>
            <span className="text-6xl font-bold text-[#ef4444] mb-3 transition-all">{pending > 0 ? pending : 0}</span>
            <span className="text-xl font-bold text-gray-800">ยังไม่สำเร็จ</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex h-screen bg-[#f4f6fb] font-sans">
      {/* Sidebar ด้านซ้าย */}
      <aside className="w-64 bg-[#1e2e40] text-white flex flex-col shadow-lg z-10">
        <div className="h-24 flex items-center justify-center border-b border-[#2a3f54]">
          <h1 className="text-4xl font-bold tracking-wider">LOGO</h1>
        </div>

        <nav className="flex-1 pt-6">
          <ul className="space-y-2 px-2">
            <li>
              {/* เมนูที่ถูกเลือก (Active) */}
              <a href="#" className="flex items-center px-6 py-3 bg-[#2b3e52] text-white rounded-lg mx-2 border-l-4 border-blue-400">
                <Home className="w-5 h-5 mr-4" />
                HOME
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center px-6 py-3 hover:bg-[#2b3e52] text-gray-300 rounded-lg mx-2 transition-colors">
                <ClipboardList className="w-5 h-5 mr-4" />
                Order
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center px-6 py-3 hover:bg-[#2b3e52] text-gray-300 rounded-lg mx-2 transition-colors">
                <Package className="w-5 h-5 mr-4" />
                Packing
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      {/* พื้นที่เนื้อหาหลักด้านขวา */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* แถบสีน้ำเงินด้านบนสุด */}
        <div className="h-8 bg-[#334d8f] w-full shadow-sm"></div>

        {/* พื้นที่ Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ส่วนหัวและตัวเลขสถิติ */}
          <div className="p-8 pb-10 bg-[#eef1f8]">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h2>
            <DashStat />
          </div>

          {/* ส่วนอัปโหลด CSV */}
          <div className="bg-white h-full flex flex-col items-center pt-20 rounded-t-3xl shadow-[-10px_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <h3 className="text-4xl font-bold text-gray-800 mb-10">Add CSV File</h3>

            <button
              onClick={handleSelectFile}
              className="bg-[#334d8f] hover:bg-[#25396b] text-white font-bold py-4 px-10 rounded-full text-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              Select CSV file
            </button>

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
                  Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                  const response = await fetch("/upload-orders", {
                    method: "POST",
                    body: formData,
                    headers: { Accept: "application/json" },
                  });

                  const data = await response.json();

                  if (!response.ok || data.status === 'error') {
                    throw new Error(data.message || 'Upload failed');
                  }

                  Swal.fire({
                    icon: "success",
                    title: `อัปโหลดไฟล์สำเร็จ`,
                    text: `\n เพิ่มแล้ว: ${data.sheet_result?.added || 0} \n ข้อมูลซ้ำ: ${data.sheet_result?.duplicates_skipped || 0}`
                  });
                } catch (err: any) {
                  Swal.fire('Error', err.message, 'error');
                }
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
