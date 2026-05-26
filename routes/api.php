<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ItemsBarcodeController;


Route::prefix('barcode')->group(function () {
    Route::get('/generate',           [ItemsBarcodeController::class, 'generate']);
    Route::get('/generate/{count}',   [ItemsBarcodeController::class, 'generateBatch']);
});
