<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ItemsBarcodeController;
use App\Http\Controllers\ProductSyncController;
use App\Http\Controllers\ShopeeController;


Route::prefix('barcode')->group(function () {
    Route::get('/generate',           [ItemsBarcodeController::class, 'generate']);
    Route::get('/generate/{count}',   [ItemsBarcodeController::class, 'generateBatch']);
});

Route::post('/sync-products',   [ProductSyncController::class, 'sync'])->name('sync-products');


// Shopee section
Route::prefix('shopee-api')->group(function () {
    Route::get('/shopeeq', [ShopeeController::class, 'queryShopeeData'])->name('shopee-query');
    Route::post('/shopeeq', [ShopeeController::class, 'queryShopeeData'])->name('shopee-query');
    Route::post('/set-packed', [ShopeeController::class, 'setpacked'])->name('shopee-setpacked');
});
