<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\SystemSettingService;

class SystemSettingController extends Controller
{
    public function update(Request $request)
    {
        // 1. Validate ข้อมูลที่ส่งมาจาก React ฟอร์ม
        $validated = $request->validate([
            'app_version' => 'required|string|max:20',
            'maintenance_mode' => 'required|in:true,false',
        ]);

        // 2. วนลูปบันทึกค่าลง DB + สั่ง Clear Redis Cache ผ่าน Service ที่เขียนไว้
        foreach ($validated as $key => $value) {
            SystemSettingService::set($key, $value);
        }

        // 3. สั่ง Redirect กลับหน้าเดิมพร้อม Flash Message
        // ตัว Inertia จะทำการเอาค่าใหม่จาก Redis ไปส่งต่อให้ React ทันทีโดยไม่ต้องโหลดหน้าเว็บใหม่
        return redirect()->back()->with('success', 'System settings updated and cache cleared successfully!');
    }
}
