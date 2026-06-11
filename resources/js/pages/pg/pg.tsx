import React, { useEffect, useState, useRef } from 'react';
import { Barcode, Search, Play, CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react';
import Swal from 'sweetalert2';

interface OrderMockup {
  tracking_number: string;
  order_sn: string;
  total_items: number;
  price: number;
}

export function BarcodeScannerComponent() {
  const [scannerStatus, setScannerStatus] = useState<'READY' | 'BLURRED' | 'PROCESSING'>('READY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scannedOrder, setScannedOrder] = useState<OrderMockup | null>(null);

  // ใช้ตัวแปรเก็บสะสมตัวอักษรที่สแกนเข้ามาชั่วคราว
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    // ฟังก์ชันดักจับการสแกนระดับ Global (พนักงานกดตรงไหนก็สแกนติด)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // ถ้าพนักงานกำลังพิมพ์ใน Search Box ตรงๆ ให้ปล่อยให้เขาพิมพ์ไป ไม่ต้องแย่งข้อมูล
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement.id === 'search-box') {
        return;
      }

      const currentTime = Date.now();

      // บาร์โค้ดสแกนเนอร์จะพิมพ์เร็วมาก (มักจะห่างกันไม่เกิน 30ms)
      if (currentTime - lastKeyTimeRef.current > 50) {
        barcodeBufferRef.current = ''; // เคลียร์บัฟเฟอร์ถ้าเป็นการพิมพ์ช้าๆ จากคีย์บอร์ดมนุษย์
      }

      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length > 0) {
          processBarcode(barcodeBufferRef.current);
          barcodeBufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    const handleWindowBlur = () => setScannerStatus('BLURRED');
    const handleWindowFocus = () => setScannerStatus('READY');

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (scannerStatus === 'BLURRED') {
        Swal.fire({
        title: 'หน้าจอหลุดโฟกัส',
        text: 'ระบบสแกนอัตโนมัติหยุดทำงานชั่วคราว (คลิกตรงไหนก็ได้บนหน้านี้เพื่อเปิดใช้งานต่อ)',
        icon: 'warning',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        });
    } else {
        Swal.close();
    }
    }, [scannerStatus]);

  const processBarcode = (code: string) => {
    setScannerStatus('PROCESSING');
    setSearchQuery(code);

    // Mockup การดึงข้อมูลออเดอร์
    setTimeout(() => {
      setScannedOrder({
        tracking_number: code,
        order_sn: `SN-${Math.floor(100000 + Math.random() * 900000)}`,
        total_items: Math.floor(Math.random() * 5) + 1,
        price: Math.floor(Math.random() * 2000) + 150,
      });
      setScannerStatus('READY');
    }, 600);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      processBarcode(searchQuery);
    }
  };

  return (
    <div className="w-full h-full min-h-[500px] bg-slate-50 flex flex-col relative rounded-xl overflow-hidden border border-slate-200">

      {/* Header & Status Area */}

      {/* Search Content & Results */}
      <div className="p-6 flex-1 flex flex-col gap-6 max-w-4xl w-full mx-auto">

        {/* Search Box Form */}
        <form onSubmit={handleSearchSubmit} className="w-full">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-slate-400" size={20} />
            <input
              id="search-box"
              type="text"
              placeholder="พิมพ์เลขพัสดุ / เลขคำสั่งซื้อ หรือยิงสแกนบาร์โค้ดได้เลย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-28 py-3.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              ค้นหา
            </button>
          </div>
        </form>


        {/* โซนแสดงผลลัพธ์ Mockup Order Card ด้านล่าง Search Box */}
        <div className="flex-1 flex flex-col justify-start">
          {scannedOrder ? (
            <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:border-blue-300 transition-all animate-fade-in">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Package size={18} className="text-blue-600" />
                  <span>ผลการค้นหาออเดอร์ล่าสุด</span>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-medium">
                  พัสดุพร้อมจัดเตรียม
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">1. Tracking Number</span>
                  <span className="text-base font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                    {scannedOrder.tracking_number}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">2. Order SN</span>
                  <span className="text-sm font-mono text-slate-600">
                    {scannedOrder.order_sn}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 md:border-none md:pt-0">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">3. สินค้าจำนวนทั้งสิ้น</span>
                  <span className="text-base font-semibold text-slate-800">
                    {scannedOrder.total_items} รายการ
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 md:border-none md:pt-0">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">4. ราคา</span>
                  <span className="text-lg font-bold text-blue-600">
                    ฿{scannedOrder.price.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 5. ปุ่มเริ่มทำงาน ธีมฟ้าตามบรีฟ */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => alert(`เริ่มทำงานกับออเดอร์: ${scannedOrder.order_sn}`)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Play size={16} fill="currentColor" />
                  <span>เริ่มทำงาน</span>
                </button>
              </div>
            </div>
          ) : (
            // Empty State ระหว่างรอสแกน
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4">
                <Barcode size={32} />
              </div>
              <p className="text-slate-600 font-medium">ยังไม่มีข้อมูลออเดอร์ที่เลือก</p>
              <p className="text-xs text-slate-400 mt-1">ยิงบาร์โค้ดจากเครื่องสแกน หรือพิมพ์ค้นหาด้านบนเพื่อแสดงข้อมูลการ์ดออเดอร์</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default BarcodeScannerComponent;
