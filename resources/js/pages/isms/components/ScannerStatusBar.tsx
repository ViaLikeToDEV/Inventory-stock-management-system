import { ScanLine } from 'lucide-react';

type ShopeeMode = 'search' | 'skunotfound';

export function ScannerStatusBar({ isFocused, mode }: { isFocused: boolean; mode: ShopeeMode | 'verify' }) {
    const label = mode === 'search'
        ? (isFocused ? 'พร้อมรับบาร์โค้ด — สแกนหรือพิมพ์ได้เลย' : 'คลิกที่ช่องค้นหาเพื่อเริ่มสแกน')
        : (isFocused ? 'พร้อมสแกนสินค้า — วาง barcode ที่ scanner' : 'กล่องรับสแกนไม่มี focus — คลิกที่ช่องก่อน');

    const modeTag = mode === 'search' ? 'SEARCH MODE' : 'VERIFY MODE';

    return (
        <div className={`flex items-center gap-2.5 p-4 py-3 rounded-xl font-medium transition-all duration-300 ${isFocused ? (mode === 'search' ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' : 'bg-blue-50 border border-blue-300 text-blue-800') : 'bg-gray-100 border border-gray-200 text-gray-500'}`}>
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                {isFocused && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${mode === 'search' ? 'bg-emerald-400' : 'bg-blue-400'}`} />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isFocused ? (mode === 'search' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-gray-400'}`} />
            </span>
            <ScanLine className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            <span className={`text-sm px-2 py-0.5 rounded-md ${isFocused ? (mode === 'search' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700') : 'bg-gray-200 text-gray-500'}`}>
                {modeTag}
            </span>
        </div>
    );
}
