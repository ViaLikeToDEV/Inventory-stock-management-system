<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GithubController;


Route::inertia('/', 'welcome')->name('home');


Route::get('/github', [GithubController::class, 'index'])->name('github.index');
Route::post('/github/search', [GithubController::class, 'search'])->name('github.search');
