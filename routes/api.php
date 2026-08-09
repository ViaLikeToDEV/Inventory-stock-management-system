<?php

use App\Http\Controllers\IndexedShopee;
use App\Http\Controllers\ItemsBarcodeController;
use App\Http\Controllers\ProductSyncController;
use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

Route::prefix('barcode')->group(function () {
    Route::get('/generate', [ItemsBarcodeController::class, 'generate']);
    Route::get('/generate/{count}', [ItemsBarcodeController::class, 'generateBatch']);
});

Route::post('/sync-products', [ProductSyncController::class, 'sync'])->name('sync-products');

Route::prefix('shopee-api')->group(function () {
    Route::controller(IndexedShopee::class)->group(function () {
        Route::get('/shopeeq', 'queryShopeeData')->name('shopee-query');
        Route::post('/shopeeq', 'queryShopeeData')->name('shopee-query');
        Route::post('/set-packed', 'setpacked')->name('shopee-setpacked');
        Route::get('/shopee_date_query', 'queryByDate')->name('shopee-date-query');
        Route::post('/shopee_req_query', 'getRequiredProducts')->name('shopee-required-query');
    });
});

Route::prefix('stock-api')->group(function () {
    Route::controller(StockController::class)->group(function () {
        Route::get('/stocks', 'fetchStocks')->name('stock-query');
        Route::post('/add-stock', 'addStock')->name('stock-add');
        Route::post('/edit-stock', 'editStock')->name('stock-edit');
        Route::post('/delete-stock', 'deleteStock')->name('stock-delete');
        Route::get('/catalog', 'catalog')->name('stock-catalog');
        Route::post('/bulk-sync', 'bulkSyncStock')->name('stock-bulk-sync');
        Route::get('/integrity-issues', 'integrityIssues')->name('stock-integrity-issues');
    });
});
