<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->integer('product_id')->primary();
            $table->string('product_name');
            $table->timestamps();
        });

        Schema::create('variants', function (Blueprint $table) {
            $table->string('sku')->primary(); // sku คือ PK ตาม sheet
            $table->integer('product_id');
            $table->string('variant_name');
            $table->string('barcode')->nullable();
            $table->foreign('product_id')->references('product_id')->on('products');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products_tables');
    }
};
