<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. ตารางเก็บเวอร์ชัน/Config (คุยกันด้วย String)
        Schema::create('system_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('value'); // เก็บเลขเวอร์ชันเป็น String ธรรมดา
            $table->timestamps();
        });

        // ✅ แก้ไขตรงนี้: ทำการ Init ค่าเริ่มต้นใน DB ให้เป็นเลข '1'
        DB::table('system_settings')->insert([
            'key' => 'shopee_gas_version',
            'value' => '1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. ตารางสินค้า
        Schema::create('products', function (Blueprint $table) {
            $table->integer('product_id')->primary();
            $table->string('product_name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 3. ตาราง Variants
        Schema::create('variants', function (Blueprint $table) {
            $table->string('sku')->primary();
            $table->integer('product_id');
            $table->string('variant_name');
            $table->string('barcode')->nullable();
            $table->string('bundle')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // กำหนด Foreign Key
            $table->foreign('product_id')->references('product_id')->on('products')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('system_settings');
    }
};
