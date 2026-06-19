import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Loader2, Package, Gift } from 'lucide-react';
import Swal from 'sweetalert2';
import ProductEditModal, { ProductRow } from './ProductEditModal';
import ProductAddModal from './ProductAddModal'; // 🟢 ดึงหน้า Add มาใช้

export default function Product() {
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);

    const [editForm, setEditForm] = useState<ProductRow | null>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);

    // 🟢 1. ดึง fetchProducts ออกมาข้างนอก จะได้สั่งโหลดใหม่จากที่ไหนก็ได้
    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/get-products', { headers: { Accept: 'application/json' } });
            const responseData = await response.json();
            if (!response.ok || responseData.status === 'error') throw new Error(responseData.message || 'ดึงข้อมูลล้มเหลว');

            setProducts(responseData.data && responseData.data.length > 0 ? responseData.data : []);
        } catch (err: any) {
            Swal.fire('ดึงข้อมูลล้มเหลว', err.message, 'error');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(p => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        if (p.productName.toLowerCase().includes(term)) return true;
        return p.variants.some(v => v.sku.toLowerCase().includes(term) || v.variantName.toLowerCase().includes(term) || v.barcode.toLowerCase().includes(term) || v.bundle.toLowerCase().includes(term));
    });

    const availableOriginSkus = useMemo(() => {
        return products.flatMap(p =>
            p.variants
                .filter(v => !v.bundle || v.bundle.trim() === '' || v.bundle === '[]')
                .map(v => ({ sku: v.sku, productName: p.productName, variantName: v.variantName }))
        );
    }, [products]);

    const allSkusInSystem = useMemo(() => {
        return products.flatMap(p => p.variants.map(v => v.sku.trim().toLowerCase()));
    }, [products]);

    const renderBundleUI = (bundleString: string) => {
        if (!bundleString || bundleString.trim() === '') return <span className="text-gray-400 italic text-xs">- ไม่มี Bundle -</span>;
        try {
            const items = JSON.parse(bundleString);
            if (!Array.isArray(items)) return <span className="text-red-500 text-xs">รูปแบบข้อมูลไม่ถูกต้อง</span>;
            return (
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {items.map((item, idx) => (
                        item.type === 'origin_sku' ? (
                            <div key={idx} className="bg-blue-50 border border-blue-100 rounded-lg p-2 flex justify-between items-start shadow-sm">
                                <div className="flex flex-col pr-2">
                                    <span className="text-blue-800 font-bold text-xs line-clamp-1" title={item.display_product_name}>{item.display_product_name}</span>
                                    <span className="text-blue-600 text-[10px] font-mono mt-0.5">SKU: {item.sku}</span>
                                </div>
                                <div className="bg-blue-600 text-white text-[11px] font-bold px-2 py-1 rounded-md shrink-0">x {item.quantity || 1}</div>
                            </div>
                        ) : item.type === 'dummy_item' ? (
                            <div key={idx} className="bg-pink-50 border border-pink-100 rounded-lg p-2 flex justify-between items-start shadow-sm">
                                <div className="flex flex-col pr-2">
                                    <span className="text-pink-800 font-bold text-xs flex items-center gap-1 line-clamp-1" title={item.display_product_name}><Gift className="w-3 h-3 shrink-0" /> {item.display_product_name}</span>
                                    {item.barcode && <span className="text-pink-500 text-[10px] font-mono mt-0.5">Bar: {item.barcode}</span>}
                                </div>
                                <div className="bg-pink-500 text-white text-[11px] font-bold px-2 py-1 rounded-md shrink-0">x {item.quantity || 1}</div>
                            </div>
                        ) : null
                    ))}
                </div>
            );
        } catch { return <div className="text-red-500 text-[11px] font-mono break-all">⚠️ JSON ผิดพลาด</div>; }
    };

    const handleSaveFullEdit = async () => {
        if (!editForm) return;

        if (!editForm.productName.trim()) {
            return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อสินค้าหลัก', 'warning');
        }

        const activeVariants = editForm.variants.filter(v => v.is_active !== false);

        if (activeVariants.some(v => !v.sku.trim())) {
            return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัส SKU ให้ครบทุกรายการ', 'warning');
        }

        // เช็คว่ากรอก SKU ซ้ำกันเองในหน้าแก้ไข
        const skusInForm = activeVariants.map(v => v.sku.trim().toLowerCase());
        const hasDuplicateInForm = skusInForm.some((sku, index) => skusInForm.indexOf(sku) !== index);
        if (hasDuplicateInForm) {
            return Swal.fire('ข้อมูลขัดแย้ง', 'กรอกรหัส SKU ซ้ำ', 'warning');
        }

        //เช็คว่า SKU ใหม่ ไปซ้ำกับ สินค้า ID อื่น ในระบบไหม
        const otherSkusInSystem = new Set();
        products.forEach(p => {
            // ข้าม ID ของตัวเอง
            if (p.id !== editForm.id) {
                p.variants.forEach(v => {
                    if (v.sku && v.is_active !== false) {
                        otherSkusInSystem.add(v.sku.trim().toLowerCase());
                    }
                });
            }
        });

        const duplicateSku = activeVariants.find(v => otherSkusInSystem.has(v.sku.trim().toLowerCase()));
        if (duplicateSku) {
            return Swal.fire({
                icon: 'error',
                title: 'รหัส SKU ซ้ำ',
                text: `รหัส SKU "${duplicateSku.sku}" ไปซ้ำกับสินค้าตัวอื่นในระบบ ไม่สามารถเพิ่มได้`,
                confirmButtonColor: '#ef4444'
            });
        }

        setEditSubmitting(true);
        try {
            const response = await fetch('/edit-product-full', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(editForm),
            });
            const data = await response.json();
            if (!response.ok || data.status === 'error') throw new Error(data.message || 'แก้ไขข้อมูลไม่สำเร็จ');

            setProducts(prev => prev.map(p => p.id === editForm.id ? editForm : p));
            await Swal.fire({ icon: 'success', title: 'อัปเดตข้อมูลเรียบร้อย', timer: 1500, showConfirmButton: false });
            setEditForm(null);
            fetchProducts();
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setEditSubmitting(false);
        }
    };

    return (
        <div className="bg-transparent h-full relative">
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสินค้า, Sku, Variant, Barcode..." className="w-full bg-white border border-gray-200 shadow-sm rounded-xl pl-12 pr-4 py-3 text-gray-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                </div>
                {/* 🟢 2. ปรับปุ่มให้สั่งเปิด showAddModal */}
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-[#33509e] hover:bg-[#2a4180] text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-blue-900/10 transition-all active:scale-95">
                    <Plus className="w-5 h-5" /> Add New
                </button>
            </div>

            <div className="w-full bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-[#f8fafc] text-gray-600 uppercase text-xs tracking-wider border-b border-gray-200">
                                <th className="text-center font-bold py-4 px-4 w-20">ID</th>
                                <th className="text-left font-bold py-4 px-4 w-[250px]">Product_name</th>
                                <th className="text-left font-bold py-4 px-4 w-[180px]">Sku</th>
                                <th className="text-left font-bold py-4 px-4 w-[200px]">Variant_name</th>
                                <th className="text-left font-bold py-4 px-4 w-[150px]">Barcode</th>
                                <th className="text-left font-bold py-4 px-4 min-w-[280px]">Bundle Items</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-12 text-gray-500 bg-white"><Loader2 className="w-8 h-8 animate-spin inline-block mb-3 text-blue-500" /><p className="font-medium">กำลังดึงข้อมูล...</p></td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-gray-500 bg-white"><div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><Package className="w-8 h-8 text-gray-400" /></div><p className="font-medium">ไม่พบข้อมูลสินค้า</p></td></tr>
                            ) : (
                                filteredProducts.map((product, pIdx) => (
                                    product.variants.map((variant, vIdx) => (
                                        <tr key={`${product.id}-${vIdx}`} className={`text-gray-700 text-sm hover:bg-blue-50/50 transition-colors ${vIdx === product.variants.length - 1 ? 'border-b-2 border-gray-200' : 'border-b border-gray-100'}`}>
                                            {vIdx === 0 && (
                                                <td rowSpan={product.variants.length} className="align-top text-center py-4 px-4 font-bold text-gray-500 bg-white border-r border-gray-100">
                                                    <span className="flex flex-col items-center gap-2">
                                                        {product.id}
                                                        <button
                                                            onClick={() => {
                                                                const cloned = JSON.parse(JSON.stringify(product));
                                                                cloned.variants = cloned.variants.map((v: any) => ({ ...v, original_sku: v.sku }));
                                                                setEditForm(cloned);
                                                            }}
                                                            className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-md transition-colors"
                                                            title="แก้ไขข้อมูล"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    </span>
                                                </td>
                                            )}
                                            {vIdx === 0 && (
                                                <td rowSpan={product.variants.length} className="align-top py-4 px-4 font-bold text-gray-800 bg-white border-r border-gray-100">
                                                    <div className="line-clamp-3 leading-relaxed" title={product.productName}>{product.productName}</div>
                                                </td>
                                            )}
                                            <td className="py-4 px-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-600 border border-gray-200">{variant.sku}</span></td>
                                            <td className="py-4 px-4 font-medium text-gray-700 break-words">{variant.variantName}</td>
                                            <td className="py-4 px-4"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider border border-blue-100">{variant.barcode}</span></td>
                                            <td className="py-3 px-4">{renderBundleUI(variant.bundle)}</td>
                                        </tr>
                                    ))
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal แก้ไข */}
            {editForm && (
                <ProductEditModal
                    editForm={editForm}
                    setEditForm={setEditForm}
                    availableOriginSkus={availableOriginSkus}
                    onClose={() => setEditForm(null)}
                    onSave={handleSaveFullEdit}
                    isSubmitting={editSubmitting}
                />
            )}

            {/* 🟢 3. เรียกใช้งาน ProductAddModal ของจริงตรงนี้ แทนก้อน HTML เก่า */}
            {showAddModal && (
                <ProductAddModal
                    availableOriginSkus={availableOriginSkus}
                    allSkusInSystem={allSkusInSystem}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        fetchProducts(); // โหลดข้อมูลใหม่จาก GAS เพื่อเอารหัส ID ล่าสุดมาโชว์
                    }}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}
