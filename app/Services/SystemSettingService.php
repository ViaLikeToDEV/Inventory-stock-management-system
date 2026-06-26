<?php

namespace App\Services;

use App\Models\SystemSetting;

class SystemSettingService
{
    // ใช้ตู้เก็บของชั่วคราวในระดับ Static Variable (Runtime Memory ของ PHP)
    private static array $registry = [];

    public static function get(string $key, $default = null): string
    {
        // 1. ถ้าเคยวิ่งไปหยิบจาก DB มาแล้วใน Request นี้ ให้เอาจาก Memory ไปตอบเลย
        if (array_key_exists($key, self::$registry)) {
            return self::$registry[$key];
        }

        // 2. ถ้ายังไม่เคยหยิบ ค่อยวิ่งไปสอยจาก SQLite/MySQL Local เครื่อง User
        $setting = SystemSetting::find($key);
        $value = $setting ? $setting->value : $default;

        // 3. จำใส่ตู้ไว้
        self::$registry[$key] = $value;

        return $value;
    }

    public static function set(string $key, string $value): void
    {
        // อัปเดตลง Local DB ตรงๆ
        SystemSetting::updateOrCreate(['key' => $key], ['value' => $value]);

        // อัปเดตค่าใน Registry ชั่วคราวด้วย
        self::$registry[$key] = $value;
    }
}
