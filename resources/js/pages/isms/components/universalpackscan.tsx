// components/UniversalPackScan.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ScanLine, AlertCircle } from 'lucide-react';
import { ScannerStatusBar } from './ScannerStatusBar';

interface ShopeePanelProps {
    onOrderFound: (order: any) => void;
    saveDirectoryHandle: any;
}

interface ShopeeProduct {
    sku: string;
    barcode: string | null;
    variant_name: string;
    product_name: string;
    quantity: number;
}

interface ShopeeOrder {
    tracking_number: string;
    order_sn: string;
    is_packed: number;
    products: ShopeeProduct[];
}

interface VersionChangedResponse {
    status: 'version_changed';
    message: string;
}

type ShopeeMode = 'search' | 'skunotfound';

export function UniversalPackScan({ onOrderFound, saveDirectoryHandle }: ShopeePanelProps) {
    const [shopeeMode, setShopeeMode] = useState<ShopeeMode>('search');
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [invalidProducts, setInvalidProducts] = useState<ShopeeProduct[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const lastKeyTimeRef = useRef<number>(0);
    const barcodeBufferRef = useRef<string>('');
    const saveDirectoryHandleRef = useRef<any>(null);

    useEffect(() => {
        saveDirectoryHandleRef.current = saveDirectoryHandle;
        if (saveDirectoryHandleRef.current){
            setIsFocused(true);
        }
    }, [saveDirectoryHandle]);

    useEffect(() => {
        const isGlobalKeyDownException = () => {
            const isExc = !saveDirectoryHandleRef.current || (document.activeElement?.tagName === 'INPUT' && document.activeElement.id === 'search-box');
            if (isExc) console.log('global input except detected');
            return isExc;
        };

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (isGlobalKeyDownException()) return;

            const currentTime = Date.now();
            if (currentTime - lastKeyTimeRef.current > 50) {
                barcodeBufferRef.current = '';
            }
            lastKeyTimeRef.current = currentTime;

            if (e.key === 'Enter') {
                if (barcodeBufferRef.current.length > 0) {
                    const scanned = barcodeBufferRef.current;
                    barcodeBufferRef.current = '';
                    setQuery(scanned);
                    handleSearch(scanned);
                }
            } else if (e.key.length === 1) {
                barcodeBufferRef.current += e.key;
            }
        };

        const handleWindowBlur = () => setIsFocused(false);
        const handleWindowFocus = () => {
            if (saveDirectoryHandleRef.current){
                setIsFocused(true);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    const handleSync = async () => {
        const Swal = (await import('sweetalert2')).default;
        Swal.fire({
            title: 'กำลังซิงค์ข้อมูล...',
            allowOutsideClick: false,
            customClass: { popup: 'rounded-2xl font-sans' },
            didOpen: () => Swal.showLoading()
        });
        try {
            await axios.post(route('sync-products'));
            await Swal.fire({
                title: 'ซิงค์ข้อมูลสินค้าสำเร็จ!',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                customClass: { popup: 'rounded-2xl font-sans' }
            });
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (err: any) {
            await Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: err.message,
                icon: 'error',
                customClass: { popup: 'rounded-2xl font-sans' }
            });
        }
    };

    useEffect(() => {
        if (shopeeMode === 'skunotfound') {
            import('sweetalert2').then((Swal) => {
                // อัปเกรดหน้าตา Modal รายชื่อสินค้าให้ตัวโต อ่านง่าย ชัดเจนขึ้น
                const productListHtml = `
                <p style="
                    font-size: 14px;
                    font-weight: 700;
                    color: #4b5563;
                    margin-bottom: 12px;
                    text-align: left;
                ">ต้องการอัพเดตฐานข้อมูลในเครื่องเพื่อรับข้อมูลชุดนี้ไหม?</p>

                <div style="
                    text-align: left;
                    max-height: 220px;
                    overflow-y: auto;
                    background: #f3f4f6;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 14px 16px;
                ">
                    <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-family: sans-serif;">
                    ${invalidProducts.map(p => `
                        <li style="font-size: 15px; color: #111827; font-weight: 800;">
                        <span>${p.sku || 'UndefinedSKU'}</span>
                        <div style="color: #4b5563; font-size: 13px; font-weight: 600; font-family: monospace; margin-top: 2px;">
                            Barcode: ${p.barcode || '❌ ไม่มีบาร์โค้ด'}
                        </div>
                        </li>
                    `).join('')}
                    </ul>
                </div>
                `;
                Swal.default.fire({
                    title: '<span style="font-size: 22px; font-weight: 900; color: #b45309;">ไม่พบ SKU ในระบบ Shopee</span>',
                    html: productListHtml,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'อัปเดตฐานข้อมูลตอนนี้',
                    cancelButtonText: 'ยกเลิก',
                    confirmButtonColor: '#ee4d2d',
                    customClass: { popup: 'rounded-3xl font-sans' }
                }).then((result) => {
                    if (result.isConfirmed) handleSync();
                    setInvalidProducts([]);
                    setShopeeMode('search');
                });
            });
        }
    }, [shopeeMode]);

    const handleSearch = useCallback(async (overrideQuery?: string) => {
        const q = (overrideQuery ?? query).trim();
        if (!q) return;
        setIsLoading(true);
        setErrorMsg('');
        try {
            const response = await axios.post<any>(route('shopee-query'), { q });
            const data = response.data;

            if (data && data.status === 'version_changed') {
                import('sweetalert2').then((Swal) => {
                    Swal.default.fire({
                        title: '<span style="font-size: 22px; font-weight: 900; color: #b45309;">แอดมินอัปเดตข้อมูลใหม่!</span>',
                        text: `${data.message}` || 'null',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'อัปเดตฐานข้อมูล',
                        confirmButtonColor: '#ee4d2d',
                        customClass: { popup: 'rounded-3xl font-sans' }
                    }).then((result) => {
                        if (result.isConfirmed) handleSync();
                        setInvalidProducts([]);
                        setShopeeMode('search');
                    });
                });
            }

            if (data.db_auto_synced === true) {
                import('sweetalert2').then((Swal) => {
                    Swal.default.fire({
                        icon: 'success',
                        title: '<span style="font-size: 20px; font-weight: 900;">ฐานข้อมูลอัปเดตสำเร็จ</span>',
                        text: '✅ ข้อมูลสินค้าเวอร์ชันล่าสุดแล้ว ทำงานต่อได้ทันที',
                        timer: 2000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        customClass: { popup: 'rounded-2xl font-sans' }
                    });
                });
                return;
            }

            const invalid = data.products.filter(p => !p.barcode);
            if (invalid.length !== 0) {
                setInvalidProducts(invalid);
                setShopeeMode('skunotfound');
            } else {
                setQuery('');
                onOrderFound(data);
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || 'เกิดข้อผิดพลาด';
            const raw = err.response?.data?.raw || '(ไม่มี raw)';
            const status = err.response?.status || '(ไม่มี status)';
            const errorActionStatus = err.response?.data?.status;
            setErrorMsg(`[${status}] ${msg} | raw: ${raw}`);

            if(errorActionStatus === 'shopee-sqlite-changed'){
                import('sweetalert2').then((Swal) => {
                    Swal.default.fire({
                        icon: 'success',
                        title: '<span style="font-size: 20px; font-weight: 900;">ดึงข้อมูลออเดอร์ใหม่</span>',
                        text: '✅ ระบบดึงออเดอร์ Shopee ล่าสุดเรียบร้อย ลุยต่อได้เลย',
                        timer: 2000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        customClass: { popup: 'rounded-2xl font-sans' }
                    });
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [query, handleSync]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
    };

    const isSearchDisabled = !saveDirectoryHandle || isLoading;

    return (
        <div className="w-full flex flex-col gap-4 text-gray-900">
            {/* สเตตัสบาร์ด้านบน */}
            <ScannerStatusBar isFocused={isFocused} mode={shopeeMode} />

            {/* เพิ่มความหนาของเส้นขอบเป็น border-2 ขยายความมนเป็น rounded-3xl ให้สอดคล้องกับ Dashboard */}
            <div className="bg-white rounded-3xl border-2 border-gray-250 shadow-md p-6 relative overflow-hidden">

                {/* 🔒 OVERLAY ม่านกระจกล็อกปุ่ม: เพิ่มความหนาตัวอักษรและ border-2 */}
                {!saveDirectoryHandle && (
                    <div className="absolute inset-0 bg-gray-50/75 backdrop-blur-[2px] z-10 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-3xl">
                        <span className="text-base font-black text-red-600 bg-white px-4 py-2.5 rounded-xl shadow-md border-2 border-red-100 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 animate-pulse" /> กรุณาเลือกโฟลเดอร์สำหรับบันทึกไฟล์ก่อนทำงาน!
                        </span>
                    </div>
                )}

                {/* ลาเบลหัวข้อขยายใหญ่ขึ้นเป็น text-base font-black พร้อมปรับสีให้เด่น */}
                <label className={`block mb-2.5 text-base font-black ${!saveDirectoryHandle ? 'text-gray-300' : 'text-gray-700'}`}>
                    ค้นหา / สแกนออเดอร์คลังสินค้า (Shopee)
                </label>

                {/* ปรับขนาด Input และ Button ให้หนา ใหญ่ และกดง่ายขึ้นมากตอนหน้างาน */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={isSearchDisabled ? undefined : handleKeyDown}
                        disabled={isSearchDisabled}
                        placeholder={saveDirectoryHandle ? "ยิงบาร์โค้ดใบปะหน้า หรือ พิมพ์ Tracking Number ที่นี่..." : "ระบบถูกล็อก: ยังไม่ได้เลือกโฟลเดอร์..."}
                        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base font-bold outline-none transition-all focus:border-[#ee4d2d] focus:ring-2 focus:ring-[#ee4d2d]/10 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        id='search-box'
                    />
                    <button
                        onClick={() => handleSearch()}
                        disabled={isSearchDisabled || !query.trim()}
                        className="bg-[#ee4d2d] hover:bg-[#d73f21] disabled:opacity-40 text-white font-black text-base px-7 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 flex-shrink-0 disabled:cursor-not-allowed shadow-sm min-h-[52px]"
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                        ) : (
                            <ScanLine className="w-5 h-5" />
                        )}
                        <span>ค้นหาออเดอร์</span>
                    </button>
                </div>

                {/* กล่องข้อความแจ้งเตือน Error ขยายใหญ่ระดับสายตาตัวหนาชัดเจน */}
                {errorMsg && (
                    <div className="mt-4 text-sm font-bold text-red-700 bg-red-50 border-2 border-red-100 px-4 py-3 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="break-all">{errorMsg}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
