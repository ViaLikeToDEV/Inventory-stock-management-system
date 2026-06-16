import React, { useState, useEffect } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  console.log('1. Component Start');

  const doubled = count * 2;

  console.log('2. Calculate');

  useEffect(() => {
    console.log('4. useEffect');
  }, [count]);

  useEffect(() => {
  console.log("รันทุกรอบ! State ไหนเปลี่ยน พร็อพไหนเปลี่ยน ฉันรันหมด!");
}, []); // 👈 ไม่มีคิวบิกต่อท้ายเลย
  console.log('3. Before Return');

  return (
    <button onClick={() => setCount(c => c + 1)}>
      {doubled}
    </button>
  );
}
