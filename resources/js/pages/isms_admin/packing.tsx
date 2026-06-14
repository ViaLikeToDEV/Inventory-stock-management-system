import React, { useState, useEffect } from 'react';
import { Search, Plus, Pencil, X, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

// ==========================================
// 🟩 Type ของข้อมูลสินค้า
// ==========================================
type Variant = {
    sku: string;
    variantName: string;
    realCount: number;
    stock: string;
    barcode: string;
};

type ProductRow = {
    id: number;
    productName: string;
    variants: Variant[];
};

// 🟡 ข้อมูลตัวอย่าง (Mock) ใช้แสดงตอนยังไม่ได้เชื่อม Excel จริง
const MOCK_PRODUCTS: ProductRow[] = [
    {
        id: 1,
        productName: 'Cubbe - ข้าวตุ๋นคิวบ์....',
        variants: [
            { sku: 'ข้าวตุ๋นปลากะพง', variantName: 'ข้าวตุ๋นปลากะพงขาว', realCount: 1, stock: 'ข้าวตุ๋นปลากะพงขาว', barcode: 'ABC-abc-1234' },
            { sku: 'ก้อนผงตับไก่...', variantName: 'ก้อนผงตับไก่ ซองเล็ก', realCount: 1, stock: 'ก้อนผงตับไก่ ซองเล็ก', barcode: 'PQL-zmx-1053' },
            { sku: 'ข้าวตุ๋นไก่', variantName: 'ข้าวตุ๋นไก่', realCount: 1, stock: 'ข้าวตุ๋นไก่', barcode: 'WBR-fgh-6721' },
            { sku: 'ข้าวตุ๋นแซลมอน', variantName: 'ข้าวตุ๋นแซsalmon', realCount: 1, stock: 'ข้าวตุ๋นแซลมอน', barcode: 'MNS-qpy-4908' },
            { sku: 'ข้าวตุ๋นปลานิล', variantName: 'ข้าวตุ๋นปลานิล', realCount: 1, stock: 'ข้าวตุ๋นปลานิล', barcode: 'CHV-bkt-3156' },
            { sku: 'ข้าวตุ๋นฟักทอง...', variantName: 'ข้าวตุ๋นฟักทอง...', realCount: 1, stock: 'ข้าวตุ๋นฟักทองแซลมอน', barcode: 'YUX-jrn-9284' },
        ],
    },
    {
        id: 2,
        productName: 'อีทสิไทย - แบบเซ็ต ...',
        variants: [
            { sku: 'สามเกลอx6ซอง', variantName: 'สามเกลอ (7g),6 ซอง ถูกกว่า', realCount: 6, stock: 'ผงสามเกลอ 7กรัม', barcode: 'DFG-swe-7044' },
        ],
    },
    {
        id: 3,
        productName: 'อีทสิไทย - แบบเซ็ต ...',
        variants: [
            { sku: 'สามเกลอx1ซอง', variantName: 'สามเกลอ (7g)', realCount: 1, stock: 'ผงสามเกลอ 7กรัม', barcode: 'DFG-swe-7044' },
        ],
    },
    {
        id: 4,
        productName: 'เซ็ตสุดคุ้ม สามเกลอ....',
        variants: [
            { sku: 'สามเกลอ,กระเทียม', variantName: 'สามเกลอ(7g),กระเทียม(7g)', realCount: 1, stock: 'ผงสามเกลอ 7กรัม', barcode: 'DFG-swe-7044' },
            { sku: 'สามเกลอ,กระเทียม', variantName: 'สามเกลอ(7g),กระเทียม(7g)', realCount: 1, stock: 'กระเทียมสับ 7กรัม', barcode: 'DFG-see-7055' },
            { sku: '(ใหญ่)สามเกลอ,ก...', variantName: 'สามเกลอ(12g),กระเทียม(12g)', realCount: 1, stock: 'สามเกลอ 12กรัม', barcode: 'DFG-see-7065' },
            { sku: '(ใหญ่)สามเกลอ,ก...', variantName: 'สามเกลอ(12g),กระเทียม(12g)', realCount: 1, stock: 'สามเกลอ 12กรัม', barcode: 'DFG-see-7075' },
        ],
    },
];

const EMPTY_FORM = {
    productName: '',
    sku: '',
    variantName: '',
    realCount: '',
    stock: '',
    barcode: '',
};

export default function Product() {
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // ป็อบอัพเพิ่มสินค้า
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);

    // ป็อบอัพแก้ไขชื่อสินค้า
    const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
    const [editName, setEditName] = useState('');
    const [editSubmitting, setEditSubmitting] = useState(false);

    // 🟢 ดึงข้อมูลสินค้าจาก API
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch('/get-products', {
                    headers: { Accept: 'application/json' },
                });
                const data = await response.json();

                if (!response.ok || data.status === 'error') {
                    throw new Error(data.message || 'ดึงข้อมูลสินค้าไม่สำเร็จ');
                }

                if (Array.isArray(data.data) && data.data.length > 0) {
                    setProducts(data.data);
                } else {
                    setProducts(MOCK_PRODUCTS);
                }
            } catch (err) {
                console.error('Fetch Products Error:', err);
                setProducts(MOCK_PRODUCTS);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // 🟢 ตัวกรองการค้นหา
    const filteredProducts = products.filter(p => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        if (p.productName.toLowerCase().includes(term)) return true;
        return p.variants.some(v =>
            v.sku.toLowerCase().includes(term) ||
            v.variantName.toLowerCase().includes(term) ||
            v.stock.toLowerCase().includes(term) ||
            v.barcode.toLowerCase().includes(term)
        );
    });

    // 🟢 จัดการ Modal เพิ่มสินค้า
    const openAddModal = () => {
        setForm(EMPTY_FORM);
        setShowAddModal(true);
    };
    const closeAddModal = () => {
        if (submitting) return;
        setShowAddModal(false);
    };

    const handleFormChange = (key: keyof typeof EMPTY_FORM, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    // 🟢 จัดการ Modal แก้ไขสินค้า
    const openEditModal = (product: ProductRow) => {
        setEditingProduct(product);
        setEditName(product.productName);
    };
    const closeEditModal = () => {
        if (editSubmitting) return;
        setEditingProduct(null);
    };

    // 🟢 ฟังก์ชันบันทึกสินค้าใหม่ (ยิงไป API)
    const handleAddProduct = async () => {
        if (!form.productName.trim()) {
            Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อสินค้า (Product_name)', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch('/add-product', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            if (!response.ok || data.status === 'error') {
                throw new Error(data.message || 'บันทึกสินค้าไม่สำเร็จ');
            }

            await Swal.fire({
                icon: 'success',
                title: 'เพิ่มสินค้าเรียบร้อย',
                timer: 1500,
                showConfirmButton: false,
            });

            setProducts(prev => ([
                ...prev,
                {
                    id: Date.now(),
                    productName: form.productName,
                    variants: [
                        {
                            sku: form.sku,
                            variantName: form.variantName,
                            realCount: Number(form.realCount) || 0,
                            stock: form.stock,
                            barcode: form.barcode,
                        },
                    ],
                },
            ]));

            setShowAddModal(false);
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 🟢 ฟังก์ชันบันทึกการแก้ไขชื่อสินค้า
    const handleSaveEditName = async () => {
        if (!editingProduct) return;
        const newName = editName.trim();
        if (!newName) {
            Swal.fire('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อสินค้า (Product_name)', 'warning');
            return;
        }

        setEditSubmitting(true);
        try {
            const response = await fetch('/edit-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ id: editingProduct.id, productName: newName }),
            });

            const data = await response.json();
            if (!response.ok || data.status === 'error') {
                throw new Error(data.message || 'แก้ไขชื่อสินค้าไม่สำเร็จ');
            }

            setProducts(prev => prev.map(p =>
                p.id === editingProduct.id ? { ...p, productName: newName } : p
            ));

            await Swal.fire({ icon: 'success', title: 'แก้ไขชื่อสินค้าเรียบร้อย', timer: 1200, showConfirmButton: false });
            setEditingProduct(null);
        } catch (err: any) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            setEditSubmitting(false);
        }
    };

    // 🟢 ส่วนการแสดงผล (UI Rendering)
    return (
        <div className="p-8">
            {/* ค้นหา + เพิ่มสินค้า */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ค้นหาสินค้า, Sku, Variant, Barcode..."
                        className="w-full bg-[#e9e6f5] rounded-xl pl-12 pr-4 py-3 text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-[#33509e] hover:bg-[#2a4180] text-white font-bold px-8 py-3 rounded-xl shadow-sm transition-colors"
                >
                    <Plus className="w-5 h-5" /> Add
                </button>
            </div>

            {/* ตารางสินค้า */}
            <div className="w-full bg-white rounded-lg overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-[#e2e2e2] text-gray-800">
                            <th className="text-center font-semibold py-4 px-4 w-20">ลำดับ</th>
                            <th className="text-left font-semibold py-4 px-4">Product_name</th>
                            <th className="text-left font-semibold py-4 px-4">Sku</th>
                            <th className="text-left font-semibold py-4 px-4">Variant_name</th>
                            <th className="text-center font-semibold py-4 px-4">Real_count</th>
                            <th className="text-left font-semibold py-4 px-4">Product_Stock</th>
                            <th className="text-left font-semibold py-4 px-4">Barcode</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-gray-500">
                                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" /> กำลังดึงข้อมูล...
                                </td>
                            </tr>
                        ) : filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-gray-500">
                                    ไม่พบข้อมูลสินค้า
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((product, pIdx) => (
                                product.variants.map((variant, vIdx) => (
                                    <tr
                                        key={`${product.id}-${vIdx}`}
                                        className={`text-gray-700 text-sm ${
                                            vIdx === product.variants.length - 1
                                                ? 'border-b-2 border-gray-300'
                                                : 'border-b border-gray-100'
                                        }`}
                                    >
                                        {vIdx === 0 && (
                                            <td rowSpan={product.variants.length} className="align-top text-center py-3 px-4 font-medium text-gray-700">
                                                <span className="inline-flex items-center gap-1">
                                                    {pIdx + 1}
                                                    <Pencil
                                                        onClick={() => openEditModal(product)}
                                                        className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-blue-500"
                                                    />
                                                </span>
                                            </td>
                                        )}
                                        {vIdx === 0 && (
                                            <td rowSpan={product.variants.length} className="align-top py-3 px-4 font-medium text-gray-700 max-w-[180px] truncate" title={product.productName}>
                                                {product.productName}
                                            </td>
                                        )}
                                        <td className="py-3 px-4 truncate max-w-[160px]" title={variant.sku}>{variant.sku}</td>
                                        <td className="py-3 px-4 truncate max-w-[200px]" title={variant.variantName}>{variant.variantName}</td>
                                        <td className="py-3 px-4 text-center">{variant.realCount}</td>
                                        <td className="py-3 px-4 truncate max-w-[200px]" title={variant.stock}>{variant.stock}</td>
                                        <td className="py-3 px-4 font-medium">{variant.barcode}</td>
                                    </tr>
                                ))
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ==========================================
                🟦 ป็อบอัพเพิ่มสินค้า
            ========================================== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative">
                        <button
                            onClick={closeAddModal}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-gray-800 mb-6">เพิ่มสินค้าใหม่</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-600 mb-1">Product_name</label>
                                <input
                                    type="text"
                                    value={form.productName}
                                    onChange={(e) => handleFormChange('productName', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                    placeholder="ชื่อสินค้า"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Sku</label>
                                <input
                                    type="text"
                                    value={form.sku}
                                    onChange={(e) => handleFormChange('sku', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Variant_name</label>
                                <input
                                    type="text"
                                    value={form.variantName}
                                    onChange={(e) => handleFormChange('variantName', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Real_count</label>
                                <input
                                    type="number"
                                    value={form.realCount}
                                    onChange={(e) => handleFormChange('realCount', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Product_Stock</label>
                                <input
                                    type="text"
                                    value={form.stock}
                                    onChange={(e) => handleFormChange('stock', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-600 mb-1">Barcode</label>
                                <input
                                    type="text"
                                    value={form.barcode}
                                    onChange={(e) => handleFormChange('barcode', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={closeAddModal}
                                disabled={submitting}
                                className="px-6 py-2 rounded-lg font-bold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleAddProduct}
                                disabled={submitting}
                                className="px-6 py-2 rounded-lg font-bold text-white bg-[#33509e] hover:bg-[#2a4180] transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                🟦 ป็อบอัพแก้ไขชื่อสินค้า
            ========================================== */}
            {editingProduct && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
                        <button onClick={closeEditModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-gray-800 mb-6">แก้ไขชื่อสินค้า</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Product_name</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                                placeholder="ชื่อสินค้า"
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={closeEditModal} disabled={editSubmitting} className="px-6 py-2 rounded-lg font-bold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50">
                                ยกเลิก
                            </button>
                            <button onClick={handleSaveEditName} disabled={editSubmitting} className="px-6 py-2 rounded-lg font-bold text-white bg-[#33509e] hover:bg-[#2a4180] transition-colors disabled:opacity-50 flex items-center gap-2">
                                {editSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
