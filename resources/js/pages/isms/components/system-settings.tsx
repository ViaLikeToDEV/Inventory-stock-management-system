import { useState } from 'react';
import { usePage, router } from '@inertiajs/react';
import { PageProps as InertiaPageProps } from '@inertiajs/core';

// 1. นิยามโครงสร้าง Props ให้ตรงกับสิ่งที่จะใช้จริงใน Local Service
interface PageProps extends InertiaPageProps {
  system_settings: {
    app_version: string;
    system_mode: string; // ใช้ system_mode ตามแนวทาง Local App
  };
  flash?: {
    success?: string;
  };
}

// สมมติว่ามี prop activeMenu ส่งเข้ามาจาก Component หลักด้านบน
interface SettingsProps {
  activeMenu: string;
}

export default function App({ activeMenu }: SettingsProps) {
  // 2. ดึงข้อมูลแบบระบุ Type ชัดเจน
  const { system_settings, flash } = usePage<PageProps>().props;

  // 3. ตั้ง State โดยอิงคีย์ให้ตรงกับระบบฐานข้อมูล
  const [values, setValues] = useState({
    app_version: system_settings?.app_version || '1.0.0',
    system_mode: system_settings?.system_mode || 'standard',
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // 4. Handle เปลี่ยนแปลงค่า (สำหรับ input และ select)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 5. ยิงเซฟลงฐานข้อมูล Local (เปลี่ยน endpoint ให้ตรงตามฝั่งคุมเครื่องตัวเอง)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    router.post('/settings/update', {
      app_version: values.app_version,
      system_mode: values.system_mode,
    }, {
      preserveScroll: true,
      onFinish: () => setIsProcessing(false),
    });
  };

  return (
    <>
      {activeMenu === 'settings' && (
        <div className="p-8 bg-[#eef1f8] min-h-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">Settings</h2>

          <div className="bg-white p-8 rounded-2xl shadow-sm text-gray-600 max-w-2xl">
            <h3 className="text-xl font-semibold text-gray-700 mb-6 pb-2 border-b">System Configurations</h3>

            {/* Notification Toast */}
            {flash?.success && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm">
                {flash.success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Input: Application Version (Locked สำหรับ Local App) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Application Version (Read-Only)
                </label>
                <input
                  type="text"
                  name="app_version"
                  value={values.app_version}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 font-mono cursor-not-allowed"
                />
                <p className="mt-1.5 text-xs text-gray-400">เวอร์ชันปัจจุบันของระบบ (ไม่สามารถแก้ไขได้จากหน้านี้)</p>
              </div>

              {/* Dropdown Select: System Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Mode
                </label>
                <select
                  name="system_mode"
                  value={values.system_mode}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800 bg-white"
                >
                  <option value="standard">Standard Mode</option>
                  <option value="developer">Developer Mode</option>
                  <option value="maintenance">Maintenance Mode</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-400">เลือกโหมดการทำงานที่ต้องการทดสอบบนเครื่อง Local ของคุณ</p>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
