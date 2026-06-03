import { useState, useEffect, useRef, useCallback } from "react";

export default function CameraSelector() {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const [devices, setDevices] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [status, setStatus] = useState("idle"); // idle | loading | active | error
    const [error, setError] = useState(null);

    // ⚠️ ต้อง request permission ก่อน ถึงจะได้ label ที่อ่านออก
    const requestPermissionAndList = useCallback(async () => {
        try {
            setStatus("loading");
            // ขอ permission ด้วย stream แรกก่อน
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            // ได้ permission แล้ว ปิด stream ชั่วคราวนี้ทิ้ง
            tempStream.getTracks().forEach((t) => t.stop());

            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const cameras = allDevices.filter((d) => d.kind === "videoinput");
            setDevices(cameras);

            if (cameras.length > 0) {
                setSelectedId(cameras[0].deviceId);
            }
            setStatus("idle");
        } catch (err) {
            setError("ไม่ได้รับอนุญาตให้เข้าถึงกล้อง: " + err.message);
            setStatus("error");
        }
    }, []);

    // เปิดกล้องตาม deviceId ที่เลือก
    const startCamera = useCallback(async (deviceId) => {
        if (!deviceId) return;

        // หยุด stream เก่าก่อน
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }

        try {
            setStatus("loading");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setStatus("active");
            setError(null);
        } catch (err) {
            setError("เปิดกล้องไม่ได้: " + err.message);
            setStatus("error");
        }
    }, []);

    // ฟัง device change (ต่อ/ถอด USB cam)
    useEffect(() => {
        navigator.mediaDevices.addEventListener("devicechange", requestPermissionAndList);
        return () => {
            navigator.mediaDevices.removeEventListener("devicechange", requestPermissionAndList);
        };
    }, [requestPermissionAndList]);

    // cleanup เมื่อ unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // เปลี่ยนกล้องเมื่อ selectedId เปลี่ยน
    useEffect(() => {
        if (selectedId) startCamera(selectedId);
    }, [selectedId, startCamera]);

    return (
        <div className="space-y-4 p-4">
            {/* Step 1: ขอ permission + list devices */}
            {devices.length === 0 && status !== "error" && (
                <button
                    onClick={requestPermissionAndList}
                    disabled={status === "loading"}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {status === "loading" ? "กำลังโหลด..." : "เปิดกล้อง"}
                </button>
            )}

            {/* Dropdown เลือกกล้อง */}
            {devices.length > 0 && (
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                        เลือกกล้อง:
                    </label>
                    <select
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        {devices.map((device, index) => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `กล้อง ${index + 1}`}
                            </option>
                        ))}
                    </select>
                    <span className="text-xs text-gray-500">
                        ({devices.length} อุปกรณ์)
                    </span>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Video preview */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video max-w-2xl">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />
                {status === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
                        กำลังเชื่อมต่อกล้อง...
                    </div>
                )}
            </div>
        </div>
    );
}
