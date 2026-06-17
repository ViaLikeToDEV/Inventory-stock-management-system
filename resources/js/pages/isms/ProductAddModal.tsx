import React, { useState } from 'react';
import { Package, X, Loader2, Trash2, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { Variant, ProductRow } from './ProductEditModal';
import { BundleEditor } from './ProductEditModal';

type Props = {
    availableOriginSkus: any[];
    onClose: () => void;
    onSuccess: () => void; // สั่งให้หน้าหลักโหลดข้อมูลใหม่หลังเซฟเสร็จ
};

const EMPTY_VARIANT: Variant = { sku: '', variantName: '', barcode: '', bundle: '' };

export default function ProductAddModal({ availableOriginSkus, onClose, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ตั้งค่าฟอร์มเริ่มต้น มี 1
    const [addForm, setAddForm] = useState<{ productName: string; variants: Variant[] }>({
        productName: '',
        variants: [{ ...EMPTY_VARIANT }]
    });

    const handleVariantEdit = (vIndex: number, field: keyof Variant, value: string) => {
        const newVariants = [...addForm.variants];
        newVariants[vIndex] = { ...newVariants[vIndex], [field]: value };
        setAddForm({ ...addForm, variants: newVariants });
    };

    const handleAddNewVariant = () => {
        setAddForm({
            ...addForm,
            variants: [...addForm.variants, { ...EMPTY_VARIANT }]
        });
    };

    const handleRemoveVariant = (vIndex: number) => {
        const newVariants = [...addForm.variants];
        newVariants.splice(vIndex, 1);
        setAddForm({ ...addForm, variants: newVariants });
    };

    const handleSaveAdd = async () => {
        if (!addForm.productName.trim()) return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อสินค้าหลัก', 'warning');

        // เช็คว่ากรอก SKU ครบไหม
        const hasEmptySku = addForm.variants.some(v => !v.sku.trim());
        if (hasEmptySku) return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัส SKU ให้ครบทุกรายการ', 'warning');

        setIsSubmitting(true);
        try {
            const response = await fetch('/add-product-full', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(addForm),
            });

            const data = await response.json();
            if (!response.ok || data.status === 'error') throw new Error(data.message || 'บันทึกข้อมูลไม่สำเร็จ');

            await Swal.fire({ icon: 'success', title: 'เพิ่มสินค้าเรียบร้อย', timer: 1500, showConfirmButton: false });
            onSuccess(); // สั่งให้หน้าหลักโหลดข้อมูลตารางใหม่
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col relative">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div>
                        เพิ่มสินค้าใหม่
                    </h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อสินค้าหลัก (Product Name) <span className="text-red-500">*</span></label>
                        <textarea value={addForm.productName} onChange={(e) => setAddForm({ ...addForm, productName: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm h-20 resize-none" placeholder="เช่น อีทสิไทย - แบบเซ็ต ผงสามเกลอ..." />
                    </div>

                    <h4 className="font-bold text-gray-800 mb-4 px-1">รายการสินค้าย่อย (Variants)</h4>
                    <div className="flex flex-col gap-6">
                        {addForm.variants.map((v, vIndex) => (
                            <div key={vIndex} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-xl"></div>

                                {addForm.variants.length > 1 && (
                                    <button onClick={() => handleRemoveVariant(vIndex)} className="absolute top-4 right-4 text-red-300 hover:text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors" title="ลบรายการนี้"><Trash2 className="w-4 h-4" /></button>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 pr-8">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">SKU <span className="text-red-500">*</span></label>
                                        <input type="text" value={v.sku} onChange={(e) => handleVariantEdit(vIndex, 'sku', e.target.value)} placeholder="เช่น SKU-01" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:bg-white focus:border-blue-500" />
                                    </div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Variant Name</label><input type="text" value={v.variantName} onChange={(e) => handleVariantEdit(vIndex, 'variantName', e.target.value)} placeholder="เช่น สีแดง" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-500" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Barcode</label><input type="text" value={v.barcode} onChange={(e) => handleVariantEdit(vIndex, 'barcode', e.target.value)} placeholder="เช่น 885123456" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:bg-white focus:border-blue-500" /></div>
                                </div>
                                <BundleEditor bundleStr={v.bundle} availableOriginSkus={availableOriginSkus} onChange={(newString: string) => handleVariantEdit(vIndex, 'bundle', newString)} />
                            </div>
                        ))}

                        <button onClick={handleAddNewVariant} className="w-full py-4 border-2 border-dashed border-blue-300 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors flex justify-center items-center gap-2 mt-2">
                            <Plus className="w-5 h-5" /> เพิ่มตัวเลือกสินค้า (Variant)
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-2xl">
                    <button onClick={onClose} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">ยกเลิก</button>
                    <button onClick={handleSaveAdd} disabled={isSubmitting} className="px-8 py-2.5 rounded-xl font-bold text-white bg-[#33509e] hover:bg-[#2a4180] shadow-md shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} บันทึกสินค้าใหม่
                    </button>
                </div>
            </div>
        </div>
    );
}
