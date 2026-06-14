import React, { useState, useEffect } from 'react';

export default function StaleCounter() {
  const [count, setCount] = useState(0);

  setCount(count + 1);
  console.log(count);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 5)}>บวกสาดๆ (+5)</button>
    </div>
  );
}
