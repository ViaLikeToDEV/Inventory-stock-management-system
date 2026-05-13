<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\OrderUploadController;

Route::post('/upload-orders', [OrderUploadController::class, 'upload']);
