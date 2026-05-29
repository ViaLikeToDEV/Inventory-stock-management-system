<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ItemsBarcodeController;
use App\Http\Controllers\ProductSyncController;

Route::prefix('barcode')->group(function () {
    Route::get('/generate',           [ItemsBarcodeController::class, 'generate']);
    Route::get('/generate/{count}',   [ItemsBarcodeController::class, 'generateBatch']);
});

Route::post('/sync-products',   [ProductSyncController::class, 'sync']);
