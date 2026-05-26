import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';

export default function Index() {
    const [inputText, setInputText] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleCheck = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        // แยกรรทัด แปลงเป็น Array ลบช่องว่างหัวท้าย และตัดบรรทัดว่างออก
        const textArray = inputText
            .split('\n')
            .map(item => item.trim())
            .filter(item => item !== '');

        setLoading(true);
        try {
            // ยิงเข้าหา Laravel route ที่เราเตรียมไว้
            const response = await axios.post('/api/products/check', {
                search_texts: textArray
            });
            setResults(response.data);
        } catch (error) {
            console.error('Error validation:', error);
            alert('Something went wrong!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Head title="Product SKU Checker" />

            <h1>SKU Checker (Google Sheets System)</h1>

            <form onSubmit={handleCheck}>
                <label htmlFor="sku-input">ใส่รายการ SKU ที่ต้องการเช็ค (1 รายการ ต่อ 1 บรรทัด):</label>
                <br />
                <textarea
                    id="sku-input"
                    rows="6"
                    cols="50"
                    placeholder="กะเพรา ธรรมดา&#10;ข้าวผัด ปู"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
                <br />
                <button type="submit" disabled={loading}>
                    {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ SKU'}
                </button>
            </form>

            <h2>ผลลัพธ์การตรวจสอบ</h2>
            {results.length > 0 ? (
                <ul>
                    {results.map((item, index) => (
                        <li key={index}>
                            <strong>{item.sku}</strong>: {item.status ? 'พบข้อมูล (True)' : 'ไม่พบ หรือสถานะไม่ Active (False)'}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>ยังไม่มีข้อมูลการตรวจสอบ</p>
            )}
        </div>
    );
}
