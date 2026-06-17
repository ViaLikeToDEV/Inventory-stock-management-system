import React, { useState, useMemo } from 'react';
import { Pencil, X, Loader2, Gift, Trash2, ListPlus, Plus } from 'lucide-react';
import Swal from 'sweetalert2';

// ==========================================
// 🟩 Types
// ==========================================
export type Variant = {
    sku: string;
    variantName: string;
    barcode: string;
    bundle: string;
    is_active?: boolean; // รองรับ Soft Delete
};

export type ProductRow = {
    id: number | string;
    productName: string;
    variants: Variant[];
};

// ==========================================
// 🛠️ Component: Bundle Builder
// ==========================================
export const BundleEditor = ({ bundleStr, availableOriginSkus, onChange }: any) => {
    const items = useMemo(() => {
        if (!bundleStr) return [];
        try { return JSON.parse(bundleStr); } catch { return []; }
    }, [bundleStr]);

    const [addType, setAddType] = useState<'origin' | 'dummy'>('origin');
    const [selSku, setSelSku] = useState('');
    const [originDispName, setOriginDispName] = useState('');
    const [originDispVar, setOriginDispVar] = useState('');
    const [selQty, setSelQty] = useState(1);
    const [dumName, setDumName] = useState('');
    const [dumVar, setDumVar] = useState('');
    const [dumBar, setDumBar] = useState('');
    const [dumQty, setDumQty] = useState(1);

    const updateBundle = (newItems: any[]) => onChange(newItems.length > 0 ? JSON.stringify(newItems) : '');
    const handleRemove = (index: number) => { const newItems = [...items]; newItems.splice(index, 1); updateBundle(newItems); };

    const handleSkuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sku = e.target.value;
        setSelSku(sku);
        if (sku) {
            const targetInfo = availableOriginSkus.find((s: any) => s.sku === sku);
            if (targetInfo) { setOriginDispName(targetInfo.productName || ''); setOriginDispVar(targetInfo.variantName || ''); }
        } else {
            setOriginDispName(''); setOriginDispVar('');
        }
    };

    const handleAddOrigin = () => {
        if (!selSku) return alert('กรุณาเลือก SKU ต้นทาง');
        if (!originDispName.trim()) return alert('กรุณากรอกชื่อแสดงผล');
        updateBundle([...items, { type: 'origin_sku', sku: selSku, quantity: Number(selQty), display_product_name: originDispName, display_variant: originDispVar }]);
        setSelSku(''); setOriginDispName(''); setOriginDispVar(''); setSelQty(1);
    };

    const handleAddDummy = () => {
        if (!dumName) return alert('กรุณากรอกชื่อของแถม');
        updateBundle([...items, { type: 'dummy_item', quantity: Number(dumQty), display_product_name: dumName, display_variant: dumVar, barcode: dumBar }]);
        setDumName(''); setDumVar(''); setDumBar(''); setDumQty(1);
    };

    return (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-2">
            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm"><ListPlus className="w-4 h-4 text-blue-600" /> จัดการ Bundle Items</h4>
            {items.length > 0 && (
                <div className="flex flex-col gap-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                    {items.map((item: any, idx: number) => (
                        <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border ${item.type === 'origin_sku' ? 'bg-blue-50 border-blue-100' : 'bg-pink-50 border-pink-100'}`}>
                            <div className="flex flex-col text-xs">
                                <span className={`font-bold ${item.type === 'origin_sku' ? 'text-blue-800' : 'text-pink-800'}`}>
                                    {item.type === 'dummy_item' && <Gift className="inline w-3 h-3 mr-1" />} {item.display_product_name}
                                </span>
                                <span className="text-gray-500 mt-0.5">
                                    {item.type === 'origin_sku' ? `SKU: ${item.sku} ` : `ของแถม ${item.barcode ? `(Bar: ${item.barcode})` : ''}`}
                                    {item.display_variant && ` | ตัวเลือก: ${item.display_variant}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-sm bg-white px-2 py-0.5 rounded shadow-sm">x {item.quantity}</span>
                                <button onClick={() => handleRemove(idx)} className="text-red-400 hover:text-red-600 bg-white p-1 rounded-md shadow-sm"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex gap-2 mb-3 border-b border-gray-100 pb-2">
                    <button onClick={() => setAddType('origin')} className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${addType === 'origin' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>📦 เพิ่มสินค้าปกติ</button>
                    <button onClick={() => setAddType('dummy')} className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${addType === 'dummy' ? 'bg-pink-100 text-pink-700' : 'text-gray-500 hover:bg-gray-100'}`}>🎁 เพิ่มของแถม</button>
                </div>
                {addType === 'origin' ? (
                    <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-3">
                            <label className="text-[10px] font-bold text-gray-500 block mb-1">เลือก SKU</label>
                            <select value={selSku} onChange={handleSkuChange} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-blue-400">
                                <option value="">-- เลือก SKU --</option>
                                {availableOriginSkus.map((s: any) => <option key={s.sku} value={s.sku}>{s.sku}</option>)}
                            </select>
                        </div>
                        <div className="col-span-12 sm:col-span-4">
                            <label className="text-[10px] font-bold text-gray-500 block mb-1">ชื่อแสดงผล</label>
                            <input type="text" value={originDispName} onChange={e => setOriginDispName(e.target.value)} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-blue-400" disabled={!selSku} />
                        </div>
                        <div className="col-span-12 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 block mb-1">ตัวเลือก</label>
                            <input type="text" value={originDispVar} onChange={e => setOriginDispVar(e.target.value)} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-blue-400" disabled={!selSku} />
                        </div>
                        <div className="col-span-8 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 block mb-1">จำนวน</label>
                            <input type="number" min="1" value={selQty} onChange={e => setSelQty(Number(e.target.value))} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-blue-400 text-center" />
                        </div>
                        <div className="col-span-4 sm:col-span-1 flex justify-end">
                            <button onClick={handleAddOrigin} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 w-full flex justify-center"><Plus className="w-4 h-4" /></button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-4"><label className="text-[10px] font-bold text-gray-500 block mb-1">ชื่อของแถม</label><input type="text" value={dumName} onChange={e => setDumName(e.target.value)} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-pink-400" /></div>
                        <div className="col-span-12 sm:col-span-3"><label className="text-[10px] font-bold text-gray-500 block mb-1">Variant (ถ้ามี)</label><input type="text" value={dumVar} onChange={e => setDumVar(e.target.value)} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-pink-400" /></div>
                        <div className="col-span-12 sm:col-span-2"><label className="text-[10px] font-bold text-gray-500 block mb-1">Barcode (ถ้ามี)</label><input type="text" value={dumBar} onChange={e => setDumBar(e.target.value)} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-pink-400" /></div>
                        <div className="col-span-8 sm:col-span-2"><label className="text-[10px] font-bold text-gray-500 block mb-1">จำนวน</label><input type="number" min="1" value={dumQty} onChange={e => setDumQty(Number(e.target.value))} className="w-full text-xs p-2 border border-gray-300 rounded-md outline-none focus:border-pink-400 text-center" /></div>
                        <div className="col-span-4 sm:col-span-1 flex justify-end"><button onClick={handleAddDummy} className="bg-pink-500 text-white p-2 rounded-md hover:bg-pink-600 w-full flex justify-center"><Plus className="w-4 h-4" /></button></div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// 🛠️ Main Modal Component
// ==========================================
type Props = {
    editForm: ProductRow;
    setEditForm: (data: ProductRow | null) => void;
    availableOriginSkus: any[];
    onClose: () => void;
    onSave: () => void;
    isSubmitting: boolean;
};

export default function ProductEditModal({ editForm, setEditForm, availableOriginSkus, onClose, onSave, isSubmitting }: Props) {
    const handleVariantEdit = (vIndex: number, field: keyof Variant, value: string) => {
        const newVariants = [...editForm.variants];
        newVariants[vIndex] = { ...newVariants[vIndex], [field]: value };
        setEditForm({ ...editForm, variants: newVariants });
    };

    const handleAddNewVariant = () => {
        setEditForm({
            ...editForm,
            variants: [
                ...editForm.variants,
                { sku: '', variantName: '', barcode: '', bundle: '', is_active: true } // ของใหม่ตั้งเป็น true เสมอ
            ]
        });
    };

    // is_active = false (Soft Delete)
    const handleRemoveVariant = (vIndex: number) => {
        Swal.fire({
            title: 'ต้องการลบสินค้านี้?',
            text: "ข้อมูลจะถูกลบออกจากระบบ",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ลบ'
        }).then((result) => {
            if (result.isConfirmed) {
                const newVariants = [...editForm.variants];

                newVariants[vIndex] = { ...newVariants[vIndex], is_active: false };
                setEditForm({ ...editForm, variants: newVariants });
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col relative">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-blue-600" /> แก้ไขข้อมูลสินค้า (ID: {editForm.id})
                    </h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อสินค้าหลัก (Product Name)</label>
                        <textarea value={editForm.productName} onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm h-20 resize-none" />
                    </div>

                    <h4 className="font-bold text-gray-800 mb-4 px-1">รายการสินค้าย่อย (Variants)</h4>
                    <div className="flex flex-col gap-6">
                        {editForm.variants.map((v, vIndex) => {
                            // 🟢 ถ้าเป็นตัวที่ถูกกดลบแล้ว ให้ซ่อนมันออกไปจากหน้าจอ!
                            if (v.is_active === false) return null;

                            return (
                                <div key={vIndex} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-xl"></div>

                                    <button
                                        onClick={() => handleRemoveVariant(vIndex)}
                                        className="absolute top-4 right-4 text-red-300 hover:text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors"
                                        title="ลบสินค้าย่อยนี้ (Soft Delete)"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 pr-8">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">
                                                SKU <span className="text-red-500">*</span>
                                            </label>
                                            <input type="text" value={v.sku} onChange={(e) => handleVariantEdit(vIndex, 'sku', e.target.value)} placeholder="เช่น SKU-NEW-01" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:bg-white focus:border-blue-500" />
                                        </div>
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Variant Name</label><input type="text" value={v.variantName} onChange={(e) => handleVariantEdit(vIndex, 'variantName', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-500" /></div>
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Barcode</label><input type="text" value={v.barcode} onChange={(e) => handleVariantEdit(vIndex, 'barcode', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:bg-white focus:border-blue-500" /></div>
                                    </div>
                                    <BundleEditor bundleStr={v.bundle} availableOriginSkus={availableOriginSkus} onChange={(newString: string) => handleVariantEdit(vIndex, 'bundle', newString)} />
                                </div>
                            );
                        })}

                        <button
                            onClick={handleAddNewVariant}
                            className="w-full py-4 border-2 border-dashed border-blue-300 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors flex justify-center items-center gap-2 mt-2"
                        >
                            <Plus className="w-5 h-5" /> เพิ่มสินค้าย่อย (SKU ใหม่)
                        </button>

                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
                    <button onClick={onClose} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">ยกเลิก</button>
                    <button onClick={onSave} disabled={isSubmitting} className="px-8 py-2.5 rounded-xl font-bold text-white bg-[#33509e] hover:bg-[#2a4180] shadow-md shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} บันทึกการเปลี่ยนแปลง
                    </button>
                </div>
            </div>
        </div>
    );
}
