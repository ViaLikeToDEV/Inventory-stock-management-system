<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;

class ProductSyncController extends Controller
{
    public function sync(): JsonResponse
    {
        try {
            Artisan::call('db:seed', [
                '--class' => 'ProductSeeder',
                '--force' => true,
            ]);

            return response()->json([
                'status'  => 'success',
                'message' => 'Products synced successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
