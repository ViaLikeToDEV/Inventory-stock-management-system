<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\OrderUploadController;
use App\Http\Controllers\SummaryController;

Route::inertia('/', 'welcome')->name('home');

// สร้าง Route สำหรับระบบ ISMS
Route::get('/isms/dashboard', function () {
    // คำสั่ง render จะวิ่งไปหาไฟล์ใน resources/js/pages/ ให้เอง
    // ดังนั้น 'isms/dashboard' จะหมายถึงไฟล์ resources/js/pages/isms/dashboard.tsx
    return Inertia::render('isms/dashboard');
});

Route::post('/upload-orders', [OrderUploadController::class, 'upload']);
Route::post('/getSummary', [SummaryController::class, 'getDailySummary']);
