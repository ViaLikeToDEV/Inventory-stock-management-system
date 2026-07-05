<?php

namespace App\Providers;

use Native\Desktop\Facades\Window;
use Native\Desktop\Contracts\ProvidesPhpIni;

class NativeAppServiceProvider implements ProvidesPhpIni
{
    /**
     * Executed once the native application has been booted.
     * Use this method to open windows, register global shortcuts, etc.
     */
    public function boot(): void
    {
        Window::open('main')
            ->title('Inventory stock manage system(Goodfriends Food)')
            ->width(1280)
            ->height(800)
            ->minWidth(1024)
            ->minHeight(768)
            ->rememberState()          // จำขนาดล่าสุด
            ->suppressNewWindows()     // ห้ามป็อปอัพงอกเอง
            ->hideMenu()               // ซ่อนแถบเมนูด้านบน (กด Alt ถึงจะขึ้น) เพื่อลดความลกรกของหน้าจอ
            ->webPreferences([
                'backgroundThrottling' => false, // ประมวลผลเบื้องหลังเต็มสปีด
                'spellcheck' => false,           // ปิดตรวจคำผิดเพื่อประหยัด CPU
            ]);

    }

    /**
     * Return an array of php.ini directives to be set.
     */
    public function phpIni(): array
    {
        return [
        ];
    }
}
