import React, { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, Loader2, Package, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    fetchStocks as fetchStocksAction,
    addStock as addStockAction,
    editStock as editStockAction,
    deleteStock as deleteStockAction,
    catalog as catalogAction,
    bulkSyncStock as bulkSyncStockAction,
    integrityIssues as integrityIssuesAction,
} from '../../../actions/App/Http/Controllers/StockController';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface StockItem {
    productName: string;
    count: number;
    barcode: string;
}

interface CatalogDiffItem extends StockItem {
    isNew: boolean;
    isBundleComponent: boolean;
    sku: string;
    variantName: string;
}

interface CatalogEnrichment {
    sku: string;
    variantName: string;
}

interface CatalogApiItem extends StockItem {
    sku: string;
    variantName: string;
}

interface IntegrityIssue {
    type: 'broken_origin_ref' | 'barcode_name_conflict';
    message: string;
    [key: string]: unknown;
}

// ─────────────────────────────────────────────
// Add / Edit Modal
// ─────────────────────────────────────────────
function StockModal({
    mode,
    initial,
    onClose,
    onSave,
}: {
    mode: 'add' | 'edit';
    initial: Partial<StockItem>;
    onClose: () => void;
    onSave: (item: Partial<StockItem>) => Promise<void>;
}) {
    const [form, setForm] = useState<Partial<StockItem>>(initial);
    const [submitting, setSubmitting] = useState(false);

    const handleSave = async () => {
        if (!form.productName?.trim()) {
            return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อสินค้า', 'warning');
        }
        setSubmitting(true);
        await onSave(form);
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-7 flex flex-col gap-5">
                <h2 className="text-xl font-bold text-gray-800">
                    {mode === 'add' ? '+ เพิ่มสต็อกสินค้า' : 'แก้ไขสต็อกสินค้า'}
                </h2>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                            Product_name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.productName ?? ''}
                            onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
                            placeholder="เช่น อีกสิไทย-สามเกลอ 7กรัม"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">count</label>
                        <input
                            type="number"
                            min={0}
                            value={form.count ?? 0}
                            onChange={e => setForm(f => ({ ...f, count: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Barcode</label>
                        <input
                            type="text"
                            value={form.barcode ?? ''}
                            onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                            placeholder="เช่น BAR-cod-223"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={submitting}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#33509e] hover:bg-[#2a4180] disabled:opacity-60 transition-colors shadow-md shadow-blue-900/10 active:scale-95"
                    >
                        {submitting ? 'กำลังบันทึก...' : mode === 'add' ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function Stocks() {
    const [stocks, setStocks] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [editItem, setEditItem] = useState<StockItem | null>(null);

    const [comparing, setComparing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [catalogDiff, setCatalogDiff] = useState<CatalogDiffItem[] | null>(null);

    const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
    const [integrityLoading, setIntegrityLoading] = useState(false);

    const [deletingBarcode, setDeletingBarcode] = useState<string | null>(null);

    // enrichment ข้อมูล SKU/ตัวเลือกสินค้าจาก SQLite (Shopee catalog) - local only, ไม่ยิงไป GAS และไม่กระทบ Stock sheet
    const [catalogEnrichment, setCatalogEnrichment] = useState<Record<string, CatalogEnrichment>>({});

    const fetchStocks = () => {
        setLoading(true);
        fetch(fetchStocksAction.url(), { headers: { Accept: 'application/json' } })
            .then(res => res.json())
            .then(data => setStocks(data?.data ?? []))
            .catch(() => setStocks([]))
            .finally(() => setLoading(false));
    };

    const fetchCatalogEnrichment = () => {
        fetch(catalogAction.url(), { headers: { Accept: 'application/json' } })
            .then(res => res.json())
            .then((data: { data?: (StockItem & CatalogEnrichment)[] }) => {
                const map: Record<string, CatalogEnrichment> = {};
                (data?.data ?? []).forEach(item => {
                    map[item.barcode] = { sku: item.sku, variantName: item.variantName };
                });
                setCatalogEnrichment(map);
            })
            .catch(() => setCatalogEnrichment({}));
    };

    const fetchIntegrityIssues = () => {
        setIntegrityLoading(true);
        fetch(integrityIssuesAction.url(), { headers: { Accept: 'application/json' } })
            .then(res => res.json())
            .then(data => setIntegrityIssues(data?.data ?? []))
            .catch(() => setIntegrityIssues([]))
            .finally(() => setIntegrityLoading(false));
    };

    useEffect(() => {
        fetchStocks();
        fetchCatalogEnrichment();
        fetchIntegrityIssues();
    }, []);

    const filteredStocks = stocks.filter(s => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
            s.productName.toLowerCase().includes(term) ||
            s.barcode.toLowerCase().includes(term)
        );
    });

    const handleAdd = async (form: Partial<StockItem>) => {
        try {
            const res = await fetch(addStockAction.url(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok || data.status === 'error') throw new Error(data.message);
            await Swal.fire({ icon: 'success', title: 'เพิ่มสต็อกเรียบร้อย', timer: 1500, showConfirmButton: false });
            setShowAddModal(false);
            fetchStocks();
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        }
    };

    const handleEdit = async (form: Partial<StockItem>) => {
        try {
            const res = await fetch(editStockAction.url(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok || data.status === 'error') throw new Error(data.message);
            await Swal.fire({ icon: 'success', title: 'อัปเดตเรียบร้อย', timer: 1500, showConfirmButton: false });
            setEditItem(null);
            fetchStocks();
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        }
    };

    const handleDelete = async (item: StockItem) => {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'ยืนยันการลบ',
            text: `ต้องการลบสต็อก "${item.productName}" ใช่หรือไม่?`,
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626',
        });
        if (!confirm.isConfirmed) return;

        setDeletingBarcode(item.barcode);
        try {
            const res = await fetch(deleteStockAction.url(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ barcode: item.barcode }),
            });
            const data = await res.json();
            if (!res.ok || data.status === 'error') throw new Error(data.message);
            await Swal.fire({ icon: 'success', title: 'ลบสต็อกเรียบร้อย', timer: 1500, showConfirmButton: false });
            fetchStocks();
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setDeletingBarcode(null);
        }
    };

    const handleCompareCatalog = async () => {
        setComparing(true);
        try {
            const res = await fetch(catalogAction.url(), { headers: { Accept: 'application/json' } });
            const data = await res.json();
            const catalogItems: CatalogApiItem[] = data?.data ?? [];

            const stockByBarcode = new Map(stocks.map(s => [s.barcode, s]));

            const diff = catalogItems.reduce<CatalogDiffItem[]>((acc, catalogItem) => {
                const existing = stockByBarcode.get(catalogItem.barcode);
                const isBundleComponent = !catalogItem.sku;

                if (!existing) {
                    acc.push({
                        barcode: catalogItem.barcode,
                        productName: catalogItem.productName,
                        count: 0,
                        isNew: true,
                        isBundleComponent,
                        sku: catalogItem.sku,
                        variantName: catalogItem.variantName,
                    });
                } else if (existing.productName !== catalogItem.productName) {
                    acc.push({
                        barcode: catalogItem.barcode,
                        productName: catalogItem.productName,
                        count: existing.count,
                        isNew: false,
                        isBundleComponent,
                        sku: catalogItem.sku,
                        variantName: catalogItem.variantName,
                    });
                }

                return acc;
            }, []);

            setCatalogDiff(diff);

            if (diff.length === 0) {
                Swal.fire({ icon: 'info', title: 'สต็อกตรงกับ Catalog อยู่แล้ว', timer: 1800, showConfirmButton: false });
            }
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setComparing(false);
        }
    };

    const handleDiffCountChange = (barcode: string, count: number) => {
        setCatalogDiff(diff => diff && diff.map(item => (item.barcode === barcode ? { ...item, count } : item)));
    };

    const handleSaveCatalogDiff = async () => {
        if (!catalogDiff || catalogDiff.length === 0) return;

        setSyncing(true);
        try {
            const res = await fetch(bulkSyncStockAction.url(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    items: catalogDiff.map(({ barcode, productName, count }) => ({ barcode, productName, count })),
                }),
            });
            const data = await res.json();
            if (!res.ok || data.status === 'error') throw new Error(data.message);
            await Swal.fire({ icon: 'success', title: 'ซิงก์สต็อกเรียบร้อย', timer: 1500, showConfirmButton: false });
            setCatalogDiff(null);
            fetchStocks();
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="bg-transparent h-full relative">
            {/* Search + Add */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="ค้นหาสินค้า หรือ Barcode..."
                        className="w-full bg-[#ece7f6] border-0 rounded-full pl-5 pr-12 py-3 text-gray-700 outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2" />
                </div>
                <button
                    onClick={handleCompareCatalog}
                    disabled={comparing || syncing}
                    className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold px-6 py-3 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
                >
                    {comparing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    เทียบ Catalog Shopee
                </button>
                <button
                    onClick={() => setShowAddModal(true)}
                    disabled={comparing || syncing}
                    className="flex items-center gap-2 bg-[#33509e] hover:bg-[#2a4180] text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-blue-900/10 transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
                >
                    <Plus className="w-5 h-5" /> Add
                </button>
            </div>

            {/* Data integrity panel */}
            {!integrityLoading && integrityIssues.length > 0 && (
                <div className="w-full bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm mb-6">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-red-200">
                        <h3 className="flex items-center gap-2 font-bold text-red-800">
                            <AlertTriangle className="w-5 h-5" />
                            พบปัญหาความสมบูรณ์ของข้อมูล Bundle ({integrityIssues.length})
                        </h3>
                        <button
                            onClick={fetchIntegrityIssues}
                            disabled={integrityLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60 transition-colors"
                        >
                            {integrityLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            ตรวจสอบใหม่
                        </button>
                    </div>
                    <ul className="divide-y divide-red-100">
                        {integrityIssues.map((issue, idx) => (
                            <li key={idx} className="px-5 py-3 text-sm text-red-800">
                                {issue.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Catalog diff review panel */}
            {catalogDiff && catalogDiff.length > 0 && (
                <div className="w-full bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm mb-6">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200">
                        <h3 className="flex items-center gap-2 font-bold text-amber-800">
                            <Sparkles className="w-5 h-5" />
                            พบข้อมูลจาก Catalog ที่ไม่ตรงกับสต็อก ({catalogDiff.length})
                        </h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCatalogDiff(null)}
                                disabled={syncing}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveCatalogDiff}
                                disabled={syncing}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 transition-colors active:scale-95"
                            >
                                {syncing ? 'กำลังบันทึก...' : 'Save'}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-amber-100/60 text-amber-800 uppercase text-xs tracking-wider">
                                    <th className="text-left font-bold py-3 px-4 w-28">สถานะ</th>
                                    <th className="text-left font-bold py-3 px-4">Product_name</th>
                                    <th className="text-center font-bold py-3 px-4 w-32">count</th>
                                    <th className="text-left font-bold py-3 px-4 w-48">Barcode</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalogDiff.map(item => (
                                    <tr key={item.barcode} className="text-sm border-b border-amber-100 last:border-b-0">
                                        <td className="py-3 px-4">
                                            {item.isNew ? (
                                                <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold">NewData</span>
                                            ) : (
                                                <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold">Updated</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-gray-800">
                                            {item.productName}
                                            {item.isBundleComponent && (
                                                <span className="ml-2 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-xs font-bold align-middle">
                                                    ของแถม/บันเดิล
                                                </span>
                                            )}
                                            {(item.sku || item.variantName) && (
                                                <div className="text-xs text-gray-400 mt-0.5 font-normal">
                                                    {item.sku && <span className="font-mono">{item.sku}</span>}
                                                    {item.sku && item.variantName && ' · '}
                                                    {item.variantName}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {item.isNew ? (
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={item.count}
                                                    onChange={e => handleDiffCountChange(item.barcode, Number(e.target.value))}
                                                    className="w-20 text-center border border-amber-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                                                />
                                            ) : (
                                                <span className="font-bold text-gray-700">{item.count}</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="bg-white text-amber-700 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider border border-amber-200">
                                                {item.barcode}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="w-full bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-[#f8fafc] text-gray-600 uppercase text-xs tracking-wider border-b border-gray-200">
                                <th className="text-center font-bold py-4 px-4 w-24">ลำดับ</th>
                                <th className="text-left font-bold py-4 px-4">Product_name</th>
                                <th className="text-center font-bold py-4 px-4 w-32">count</th>
                                <th className="text-left font-bold py-4 px-4 w-48">Barcode</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin inline-block mb-3 text-blue-500" />
                                        <p className="font-medium">กำลังดึงข้อมูล...</p>
                                    </td>
                                </tr>
                            ) : filteredStocks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-500">
                                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Package className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium">ไม่พบข้อมูลสต็อกสินค้า</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredStocks.map((item, idx) => {
                                    const enrichment = catalogEnrichment[item.barcode];

                                    return (
                                        <tr
                                            key={item.barcode}
                                            className="text-gray-700 text-sm hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-b-0"
                                        >
                                            {/* ลำดับ + ปุ่มแก้ไข */}
                                            <td className="text-center py-4 px-4">
                                                <span className="flex items-center justify-center gap-2 text-gray-500 font-semibold">
                                                    {idx + 1}
                                                    <button
                                                        onClick={() => setEditItem(item)}
                                                        disabled={deletingBarcode === item.barcode}
                                                        className="p-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-md disabled:opacity-50 disabled:pointer-events-none transition-colors"
                                                        title="แก้ไข"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        disabled={deletingBarcode === item.barcode}
                                                        className="p-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-md disabled:opacity-50 disabled:pointer-events-none transition-colors"
                                                        title="ลบ"
                                                    >
                                                        {deletingBarcode === item.barcode ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="font-medium text-gray-800">{item.productName}</div>
                                                {enrichment && (
                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                        {enrichment.sku && <span className="font-mono">{enrichment.sku}</span>}
                                                        {enrichment.sku && enrichment.variantName && ' · '}
                                                        {enrichment.variantName}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center font-bold text-gray-700">{item.count}</td>
                                            <td className="py-4 px-4">
                                                <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider border border-blue-100">
                                                    {item.barcode}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal เพิ่ม */}
            {showAddModal && (
                <StockModal
                    mode="add"
                    initial={{ productName: '', count: 0, barcode: '' }}
                    onClose={() => setShowAddModal(false)}
                    onSave={handleAdd}
                />
            )}

            {/* Modal แก้ไข */}
            {editItem && (
                <StockModal
                    mode="edit"
                    initial={editItem}
                    onClose={() => setEditItem(null)}
                    onSave={handleEdit}
                />
            )}
        </div>
    );
}
