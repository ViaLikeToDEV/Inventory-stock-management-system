<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ItemsBarcodeController;
use App\Http\Controllers\ProductSyncController;
use App\Http\Controllers\ShopeeController;
use App\Http\Controllers\IndexedShopee;



Route::prefix('barcode')->group(function () {
    Route::get('/generate',           [ItemsBarcodeController::class, 'generate']);
    Route::get('/generate/{count}',   [ItemsBarcodeController::class, 'generateBatch']);
});

Route::post('/sync-products',   [ProductSyncController::class, 'sync'])->name('sync-products');


Route::prefix('shopee-api')->group(function () {
    Route::controller(IndexedShopee::class)->group(function () {
        Route::get('/shopeeq', 'queryShopeeData')->name('shopee-query');
        Route::post('/shopeeq', 'queryShopeeData')->name('shopee-query');
        Route::post('/set-packed', 'setpacked')->name('shopee-setpacked');
        Route::get('/shopee_date_query', 'queryByDate')->name('shopee-date-query');
    });
});
