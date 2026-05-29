import { useState } from 'react';


export default function PgPage(){
        const [loading, setLoading] = useState(false);
        const [result, setResult] = useState(null);

        const handleSync = async () => {
            setLoading(true);
            setResult(null);

            try {
            const res = await fetch('/api/sync-products', { method: 'POST' });
            const data = await res.json();
            setResult(data);
            } catch (err) {
            setResult({ status: 'error', message: err.message });
            } finally {
            setLoading(false);
            }
        };

    return (
        <>
            <div>
                <button onClick={handleSync} disabled={loading}>
                    {loading ? 'Syncing...' : 'Sync Products'}
                </button>
                {result && (
                    <p style={{ color: result.status === 'success' ? 'green' : 'red' }}>
                    {result.message}
                    </p>
                )}
                </div>
        </>
    )}
