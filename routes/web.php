<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\OrderUploadController;
use App\Http\Controllers\SummaryController;
use App\Http\Controllers\SkuFetchTestController;
use App\Http\Controllers\PlaygroundController;
use App\Http\Controllers\ProductAdminController;


Route::inertia('/', 'welcome')->name('home');

// สร้าง Route สำหรับระบบ ISMS
Route::get('/', function () {
    // คำสั่ง render จะวิ่งไปหาไฟล์ใน resources/js/pages/ ให้เอง
    // ดังนั้น 'isms/dashboard' จะหมายถึงไฟล์ resources/js/pages/isms/dashboard.tsx
    return Inertia::render('isms/dashboard');
});

Route::inertia('/item-scan', 'item-scan');
Route::inertia('/input', 'pg/input');
// Route::inertia('/barcode', 'barcods');

Route::post('/upload-orders', [OrderUploadController::class, 'upload']);
Route::post('/getSummary', [SummaryController::class, 'getDailySummary']);

Route::get('/products/check', [SkuFetchTestController::class, 'index']);
Route::post('/api/products/check', [SkuFetchTestController::class, 'check']);

Route::controller(PlaygroundController::class)->group(function () {
    Route::get('/pg', 'page');
    Route::get('/pgf', 'getDailySummary');
    Route::get('/pgpack', 'pack');
    Route::get('/pgmonth', 'queryTrackings');
    Route::get('/pg1', 'querySingle');
});

Route::inertia('/focus', 'pg/InputTracker');
Route::get('/get-packing-orders', [OrderUploadController::class, 'getOrders']);

////////////////// admin///////////
Route::get('/admin/dashboard', function () {
    // ไปเรียกไฟล์ที่ resources/js/pages/isms/dashboardAdmin.tsx
    return Inertia::render('isms/dashboardAdmin');
})->name('admin.dashboard');
Route::get('/get-products', [ProductAdminController::class, 'fetchProducts']);
Route::post('/edit-product-full', [App\Http\Controllers\ProductAdminController::class, 'editProductFull']);

