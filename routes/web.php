<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\OrderUploadController;
use App\Http\Controllers\SummaryController;
use App\Http\Controllers\SkuFetchTestController;
use App\Http\Controllers\PlaygroundController;
use App\Http\Controllers\ProductAdminController;
use App\Http\Controllers\SystemSettingController;
use Native\Desktop\Dialog;
use Illuminate\Http\Request; // 👈 เติมบรรทัดนี้เข้าไป!


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
    Route::get('/pgf', 'pgfunc');
    Route::get('/pgpack', 'pack');
    Route::get('/pgmonth', 'queryTrackings');
    Route::get('/pg1', 'querySingle');
});


Route::get('/test-dto', [PlaygroundController::class, 'index']);
Route::post('/test-dto', [PlaygroundController::class, 'store'])->name('test-dto.store');



Route::post('/admin/settings', [SystemSettingController::class, 'update']);

Route::inertia('/focus', 'pg/InputTracker');
Route::get('/get-packing-orders', [OrderUploadController::class, 'getOrders']);


Route::post('/api/select-directory', function () {
    try {
        // v2 syntax — folder picker
        $path = Dialog::new()
            ->title('เลือกโฟลเดอร์บันทึกวิดีโอ')
            ->folders()   // ← ใช้ folders() ไม่ใช่ folder()
            ->open();

        return response()->json([
            'path' => $path,
            'success' => !is_null($path)
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'path' => null,
            'success' => false,
            'error' => $e->getMessage()  // ← ดู error ตรงๆ
        ], 500);
    }
});

Route::post('/api/save-video', function (Request $request) {
    $dirPath  = $request->input('path');
    $yearMonth = $request->input('yearMonth');
    $fileName  = $request->input('fileName');
    $base64    = $request->input('video');

    $fullDir = $dirPath . DIRECTORY_SEPARATOR . $yearMonth;

    if (!is_dir($fullDir)) {
        mkdir($fullDir, 0755, true);
    }

    $fullPath = $fullDir . DIRECTORY_SEPARATOR . $fileName;
    file_put_contents($fullPath, base64_decode($base64));

    return response()->json(['success' => true]);
});

////////////////// admin///////////
Route::get('/admin/dashboard', function () {
    // ไปเรียกไฟล์ที่ resources/js/pages/isms/dashboardAdmin.tsx
    return Inertia::render('isms/dashboardAdmin');
})->name('admin.dashboard');
Route::get('/get-products', [ProductAdminController::class, 'fetchProducts']);
Route::post('/edit-product-full', [App\Http\Controllers\ProductAdminController::class, 'editProductFull']);
Route::post('/add-product-full', [App\Http\Controllers\ProductAdminController::class, 'addProductFull']);

