import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ScanLine, AlertCircle} from 'lucide-react';
import { ScannerStatusBar } from './ScannerStatusBar';


interface ShopeePanelProps {
    onOrderFound: (order: any) => void;
    saveDirectoryHandle: any; // 👈 เพิ่มบรรทัดนี้ (หรือเปลี่ยน any เป็น FileSystemDirectoryHandle ถ้าอยากได้ Type แม่นๆ)
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
        // inputRef.current?.focus();

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // ถ้าพนักงานกำลังพิมพ์ใน Search Box ตรงๆ ให้ปล่อยให้เขาพิมพ์ไป ไม่ต้องแย่งข้อมูล
        if (!saveDirectoryHandleRef.current) {return;}
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
                const scanned = barcodeBufferRef.current;
                barcodeBufferRef.current = '';
                setQuery(scanned);
                handleSearch(scanned); // ← ส่งค่าตรงๆ ไม่พึ่ง state
            }
        } else if (e.key.length === 1) {
            barcodeBufferRef.current += e.key;
        }
        };

        const handleWindowBlur = () => setIsFocused(false);
        const handleWindowFocus = () => setIsFocused(true);

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
        Swal.fire({ title: 'กำลังซิงค์ข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            await axios.post(route('sync-products'));
            await Swal.fire({ title: 'ซิงค์ข้อมูลสำเร็จ!', icon: 'success', timer: 2000, showConfirmButton: false });
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (err: any) {
            await Swal.fire({ title: 'เกิดข้อผิดพลาด', text: err.message, icon: 'error' });
        }
    };

    useEffect(() => {
        if (shopeeMode === 'skunotfound') {
            import('sweetalert2').then((Swal) => {
                const productListHtml = `
                <p style="
                    font-size: 12px;
                    color: #9ca3af;
                    margin-bottom: 10px;
                    text-align: left;
                ">ต้องการอัพเดตฐานข้อมูลในเครื่อง?</p>

                <div style="
                    text-align: left;
                    max-height: 180px;
                    overflow-y: auto;
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 10px 12px;
                ">
                    <ul style="margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 6px;">
                    ${invalidProducts.map(p => `
                        <li style="font-size: 13px; color: #374151;">
                        <span style="font-weight: 600;">${p.sku || 'UndefinedSKU'}</span>
                        <span style="color: #9ca3af; font-size: 11px; margin-left: 6px; font-family: monospace;">
                            Barcode: ${p.barcode || 'ไม่มี'}
                        </span>
                        </li>
                    `).join('')}
                    </ul>
                </div>
                `;
                Swal.default.fire({
                    title: 'ไม่พบ SKU ในระบบ Shopee',
                    html: productListHtml,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'อัปเดตฐานข้อมูล'
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
            const response = await axios.post<ShopeeOrder>(route('shopee-query'), { q });
            const data = response.data;
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
            setErrorMsg(`[${status}] ${msg} | raw: ${raw}`);
        } finally {
            setIsLoading(false);
        }
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
    };

    const isSearchDisabled = !saveDirectoryHandle || isLoading;

    return (

        <div className="w-full flex flex-col gap-3">
        <ScannerStatusBar isFocused={isFocused} mode={shopeeMode} />

        {/* เพิ่ม relative เข้าไปที่กล่อง เพื่อให้ overlay ทำงานได้ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 relative overflow-hidden">

            {/* 🔒 OVERLAY: ถ้าไม่มี handle จะขึ้นม่านกระจกบังและล็อกไม่ให้กดอะไรได้เลย */}
            {!saveDirectoryHandle && (
                <div className="absolute inset-0 bg-gray-50/60 backdrop-blur-[1px] z-10 flex items-center justify-center border border-dashed border-gray-300 rounded-xl">
                    <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1.5 rounded-md shadow-sm border border-gray-100">
                        ⚠️ กรุณาเลือกโฟลเดอร์สำหรับบันทึกไฟล์ก่อนค้นหา
                    </span>
                </div>
            )}

            <label className={`block mb-2 text-sm font-medium ${!saveDirectoryHandle ? 'text-gray-300' : 'text-gray-500'}`}>
                ค้นหาออเดอร์ (Shopee)
            </label>

            <div className="flex gap-2">
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={isSearchDisabled ? undefined : handleKeyDown} // ล็อกปุ่ม Enter บนคีย์บอร์ด
                    // onFocus={() => setIsFocused(true)}
                    // onBlur={() => setIsFocused(false)}
                    disabled={isSearchDisabled} // ล็อก input
                    placeholder={saveDirectoryHandle ? "สแกน / พิมพ์ Tracking หรือ Order SN..." : "ยังไม่ได้เลือกโฟลเดอร์..."}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#ee4d2d] disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    id='search-box'
                />
                <button
                    onClick={handleSearch}
                    disabled={isSearchDisabled || !query.trim()} // ล็อกปุ่มกด
                    className="bg-[#ee4d2d] hover:bg-[#d73f21] disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                    ) : (
                        <ScanLine className="w-4 h-4" />
                    )}
                    ค้นหา
                </button>
            </div>
            {errorMsg && <div className="mt-2.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{errorMsg}</div>}
        </div>
        </div>
    );
}
