import React, { useState } from 'react';

const DataParserComponent = () => {
  const [rawData, setRawData] = useState(`[1] ชื่อสินค้า:Cubbe - เซ็ตโจ๊กชงร้อนคละ 4 รส (Instant Porridge - Cubbe) ข้าวเด็ก 8 เดือน+ มีข้าว เนื้อสัตว์และผัก; ชื่อตัวเลือก:โจ๊กชงร้อน คละรส4รส; ราคา: ฿104; จำนวน: 5; เลขอ้างอิง SKU (SKU Reference No.): โจ๊กคละ 4 รส;
[2] ชื่อสินค้า:[สินค้าแถม] Example Cubbe Snacks ตัวอย่างขนมผลไม้ฟรีซดราย; ชื่อตัวเลือก:ขนมสตอแท่ง; ราคา: ฿0; จำนวน: 1; เลขอ้างอิง SKU (SKU Reference No.): ตัวอย่างขนมสตอแท่ง1; `);

  const [parsedData, setParsedData] = useState([]);

  const handleParse = () => {
    if (!rawData.trim()) return;

    // 1. แยกข้อมูลออกเป็นแต่ละชิ้นตามโครงสร้าง [ตัวเลข]
    // ใช้ Lookahead ใน Regex เพื่อไม่ให้ตัว [1], [2] หายไปตอน split
    const itemsRaw = rawData.split(/(?=\[\d+\])/).filter(Boolean);

    const result = itemsRaw.map((itemStr) => {
      // Helper function สำหรับดึงข้อมูลด้วย Regex
      const getValue = (regex) => {
        const match = itemStr.match(regex);
        return match ? match[1].trim() : '';
      };

      // Clean ค่าราคา (ลบเครื่องหมาย ฿ ออกแล้วแปลงเป็นตัวเลข)
      const rawPrice = getValue(/ราคา:\s*฿?([\d,]+)/);
      const price = parseFloat(rawPrice.replace(/,/g, '')) || 0;

      return {
        index: getValue(/\[(\d+)\]/),
        productName: getValue(/ชื่อสินค้า:(.*?);/),
        variantName: getValue(/ชื่อตัวเลือก:(.*?);/),
        price: price,
        quantity: parseInt(getValue(/จำนวน:\s*(\d+);/), 10) || 0,
        sku: getValue(/เลขอ้างอิง SKU \(SKU Reference No\.\):\s*(.*?);/),
      };
    });

    setParsedData(result);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h3>Raw Data Input</h3>
      <textarea
        rows="6"
        style={{ width: '100%', marginBottom: '10px' }}
        value={rawData}
        onChange={(e) => setRawData(e.target.value)}
      />
      <button onClick={handleParse} style={{ padding: '8px 16px', cursor: 'pointer' }}>
        Parse Data!
      </button>

      <h3>Result (JSON)</h3>
      <pre style={{ background: '#f4f4f4', padding: '15px', borderRadius: '5px' }}>
        {JSON.stringify(parsedData, null, 2)}
      </pre>
    </div>
  );
};

export default DataParserComponent;
