<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\OrderUploadController;
use App\Http\Controllers\SummaryController;
use App\Http\Controllers\SkuFetchTestController;
use App\Http\Controllers\PlaygroundController;


Route::inertia('/', 'welcome')->name('home');

// สร้าง Route สำหรับระบบ ISMS
Route::get('/', function () {
    // คำสั่ง render จะวิ่งไปหาไฟล์ใน resources/js/pages/ ให้เอง
    // ดังนั้น 'isms/dashboard' จะหมายถึงไฟล์ resources/js/pages/isms/dashboard.tsx
    return Inertia::render('isms/dashboard');
});

Route::inertia('/item-scan', 'item-scan');
Route::inertia('/input', 'input');
// Route::inertia('/barcode', 'barcods');

Route::post('/upload-orders', [OrderUploadController::class, 'upload']);
Route::post('/getSummary', [SummaryController::class, 'getDailySummary']);

Route::get('/products/check', [SkuFetchTestController::class, 'index']);
Route::post('/api/products/check', [SkuFetchTestController::class, 'check']);

Route::get('/pg', [PlaygroundController::class, 'page']);
Route::get('/shopeeq', [PlaygroundController::class, 'queryShopeeData']);
Route::post('/shopeeq', [PlaygroundController::class, 'queryShopeeData']);

Route::inertia('/focus', 'InputTracker');
Route::get('/get-packing-orders', [OrderUploadController::class, 'getOrders']);


