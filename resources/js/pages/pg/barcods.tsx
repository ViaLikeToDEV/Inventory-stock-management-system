import React, { useState } from 'react';

export default function EanGenerator() {
  const [eanCode, setEanCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateEan = () => {
    setLoading(true);
    setError(null);

    // ใช้ fetch API มาตรฐานของ Browser
    fetch('/barcode-generator')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          setEanCode(data.ean13);
        } else {
          throw new Error('Failed to generate EAN');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('เกิดข้อผิดพลาดในการดึงข้อมูล');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div>
      <h3>EAN-13 Generator</h3>

      <div>
        {loading && <p>กำลังสุ่ม...</p>}
        {!loading && eanCode && <strong>{eanCode}</strong>}
        {!loading && !eanCode && <p>ยังไม่มีข้อมูล</p>}
      </div>

      {error && <p>{error}</p>}

      <button onClick={handleGenerateEan} disabled={loading}>
        สุ่มเลข EAN-13
      </button>
    </div>
  );
}
