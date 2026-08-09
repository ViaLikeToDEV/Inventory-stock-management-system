// components/UploadQueuePanel.tsx
import { AlertCircle, CheckCircle2, UploadCloud, X } from 'lucide-react';

export type UploadPhase = 'encoding' | 'uploading' | 'processing';

export type UploadState = {
    status: 'uploading' | 'success' | 'error';
    phase: UploadPhase;
    progress: number;
    blob: Blob;
    fileName: string;
};

interface UploadQueuePanelProps {
    queue: Record<string, UploadState>;
    onRetry: (orderId: string) => void;
    onDismiss: (orderId: string) => void;
}

const phaseLabel = (item: UploadState) => {
    switch (item.phase) {
        case 'encoding':
            return 'กำลังเตรียมไฟล์...';
        case 'processing':
            return 'กำลังประมวลผลบนไดรฟ์...';
        default:
            return 'กำลังอัปโหลดขึ้นไดรฟ์...';
    }
};

export function UploadQueuePanel({ queue, onRetry, onDismiss }: UploadQueuePanelProps) {
    const entries = Object.entries(queue);
    if (entries.length === 0) return null;

    return (
        <div className="fixed bottom-5 right-5 z-[120] flex flex-col-reverse gap-3 w-[340px] max-w-[calc(100vw-2.5rem)]">
            {entries.map(([orderId, item]) => {
                return (
                    <div
                        key={orderId}
                        className="bg-white rounded-2xl border-2 border-gray-200 shadow-[0_12px_30px_rgba(0,0,0,0.15)] px-4 py-3.5 flex flex-col gap-2.5 animate-fade-in"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-sm font-black text-gray-900 truncate">{orderId}</div>
                                <div className="text-[11px] font-bold text-gray-400 font-mono truncate">{item.fileName}</div>
                            </div>
                            {item.status !== 'uploading' && (
                                <button
                                    onClick={() => onDismiss(orderId)}
                                    className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {item.status === 'uploading' && (
                            <>
                                <span className="text-xs font-black text-blue-600 flex items-center gap-1.5">
                                    <UploadCloud className="w-4 h-4 animate-bounce" />
                                    {phaseLabel(item)}
                                </span>
                                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                                    <div className="h-2 w-full bg-blue-500 rounded-full animate-pulse" />
                                </div>
                            </>
                        )}

                        {item.status === 'success' && (
                            <span className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                อัปโหลดขึ้นไดรฟ์สำเร็จ
                            </span>
                        )}

                        {item.status === 'error' && (
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-red-600 flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4" />
                                    อัปโหลดล้มเหลว
                                </span>
                                <button
                                    onClick={() => onRetry(orderId)}
                                    className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-black border-2 border-red-200 hover:bg-red-100 transition-colors"
                                >
                                    🔄 ลองใหม่
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
