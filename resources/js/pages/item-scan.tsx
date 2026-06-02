import React, { useState } from 'react';

// 1. สร้าง Data Mockup ขึ้นมานอก Component (จะได้ไม่โดนสร้างใหม่ทุกครั้งที่ Re-render)
const mockData = [
    { id: "001", name: "สินค้า A", price: 150 },
    { id: "002", name: "สินค้า B", price: 320 },
    { id: "003", name: "สินค้า C", price: 450 }
];

// 2. ChildComponent รอรับ Object ที่ค้นหาเจอ (ไม่ใช่รับแค่ ID แล้ว)
function ChildComponent({ foundData }) {
    // เงื่อนไข: ถ้าหาไม่เจอ หรือยังไม่ได้พิมพ์อะไร (foundData เป็น undefined/null) จะไม่ Render อะไรเลย
    if (!foundData) {
        return null;
    }

    return (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
            <h3>--- ข้อมูลที่ค้นพบ ---</h3>
            <p>ID: <strong>{foundData.id}</strong></p>
            <p>ชื่อสินค้า: {foundData.name}</p>
            <p>ราคา: {foundData.price} บาท</p>
        </div>
    );
}

// 3. Component หลัก
function Page() {
    const [searchId, setSearchId] = useState("");

    // ค้นหา Object จาก mockData ที่มี id ตรงกับที่ผู้ใช้พิมพ์ใน searchId
    const matchedObject = mockData.find(item => item.id === searchId);

    return (
        <>
            <div>
                <label htmlFor="search-input">ค้นหาด้วย ID สินค้า: </label>
                <input
                    id="search-input"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    placeholder="ลองพิมพ์ 001, 002 หรือ 003"
                />
            </div>

            {/* ส่ง Object ที่ค้นหาเจอ (ถ้าไม่เจอก็จะเป็น undefined) ไปให้ชั้นถัดไป */}
            <ChildComponent foundData={matchedObject} />
        </>
    );
}

export default Page;
