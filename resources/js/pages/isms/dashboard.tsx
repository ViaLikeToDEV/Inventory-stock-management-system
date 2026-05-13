import React, { useRef } from 'react';
import { Home, ClipboardList, Package } from 'lucide-react';

export default function Dashboard() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSelectFile = () => {
    fileInputRef.current?.click();
  };
  return (
    <div className="flex h-screen bg-[#f4f6fb] font-sans">

      {/* Sidebar ด้านซ้าย */}
      <aside className="w-64 bg-[#1e2e40] text-white flex flex-col shadow-lg">
        <div className="h-24 flex items-center justify-center border-b border-[#2a3f54]">
          <h1 className="text-4xl font-medium tracking-wider">LOGO</h1>
        </div>

        <nav className="flex-1 pt-6">
          <ul className="space-y-1">
            <li>
              {/* เมนูที่ถูกเลือก (Active) */}
              <a href="#" className="flex items-center px-6 py-3 bg-[#2b3e52] text-white border-l-4 border-blue-400">
                <Home className="w-5 h-5 mr-4" />
                HOME
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center px-6 py-3 hover:bg-[#2b3e52] text-gray-300 transition-colors">
                <ClipboardList className="w-5 h-5 mr-4" />
                Order
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center px-6 py-3 hover:bg-[#2b3e52] text-gray-300 transition-colors">
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
        <div className="h-8 bg-[#334d8f] w-full"></div>

        {/* พื้นที่ Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ส่วนหัวและตัวเลขสถิติ (พื้นหลังสีอ่อน) */}
          <div className="p-8 pb-10 bg-[#eef1f8]">
            {/* หมายเหตุ: ในรูปต้นฉบับพิมพ์ว่า Drashborad ผมขออนุญาตแก้เป็น Dashboard ให้ถูกต้องนะครับ */}
            <h2 className="text-2xl font-bold text-gray-600 mb-8">Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1: ออเดอร์ทั้งหมด */}
              <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center h-40">
                <span className="text-6xl font-bold text-[#0ea5e9] mb-3">10</span>
                <span className="text-xl font-bold text-gray-800">ออเดอร์ทั้งหมด</span>
              </div>

              {/* Card 2: สำเร็จแล้ว */}
              <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center h-40">
                <span className="text-6xl font-bold text-[#22c55e] mb-3">0</span>
                <span className="text-xl font-bold text-gray-800">สำเร็จแล้ว</span>
              </div>

              {/* Card 3: ยังไม่สำเร็จ */}
              <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center h-40">
                <span className="text-6xl font-bold text-[#ef4444] mb-3">0</span>
                <span className="text-xl font-bold text-gray-800">ยังไม่สำเร็จ</span>
              </div>
            </div>
          </div>

          {/* ส่วนอัปโหลด CSV (พื้นหลังสีขาว) */}
          <div className="bg-white h-full flex flex-col items-center pt-20">
            <h3 className="text-4xl font-bold text-black mb-10">Add CSV File</h3>

            <button
            onClick={handleSelectFile}
            className="bg-[#334d8f] hover:bg-[#25396b] text-white font-bold py-4 px-10 rounded-full text-xl shadow-md transition-all"
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

                const response = await fetch("/upload-orders", {
                    method: "POST",
                    body: formData,
                    headers: {
                    Accept: "application/json",
                    },
                });

                const data = await response.json();

                console.log(data);
                }}
            />
          </div>

        </div>
      </main>

    </div>
  );
}
