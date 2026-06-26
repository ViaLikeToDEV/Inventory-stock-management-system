<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class VersionCheckerService
{
    // Controller เรียก method นี้อย่างเดียว
    // รับ Response → คืน bool (mismatch หรือเปล่า)
    public function check(?Response $response): bool
    {
        if (!$response || $response->failed()) {
            Log::error("❌ Cannot fetch version from GAS API.");
            return false;
        }

        $currentGasVersion = trim($response->body());
        $versionSetting    = SystemSetting::where('key', 'gas_version')->first();

        // ยังไม่มี record → สร้างใหม่ ถือว่าไม่ mismatch
        if (!$versionSetting) {
            SystemSetting::create(['key' => 'gas_version', 'value' => $currentGasVersion]);
            return false;
        }

        // เวอร์ชันตรงกัน → ปกติ
        if ($versionSetting->value === $currentGasVersion) {
            return false;
        }

        // เวอร์ชันไม่ตรง → sync แล้วคืน true
        Log::info("🚨 Version Changed! Local: [{$versionSetting->value}] → GAS: [{$currentGasVersion}]");

        try {
            Artisan::call('db:seed', [
                '--class' => 'ProductSeeder',
                '--force' => true,
            ]);
            Log::info("✅ Auto-sync completed.");
        } catch (\Exception $e) {
            Log::error("❌ Auto-sync failed: " . $e->getMessage());
        }

        return true; // mismatch เกิดขึ้น แจ้ง caller ให้รู้
    }
}
