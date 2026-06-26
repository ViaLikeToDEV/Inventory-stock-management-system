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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('tracking_number', 50)->unique(); // Unique ค้นหาไวสุดๆ
            $table->string('order_sn', 50)->unique();       // Unique ค้นหาไวสุดๆ
            $table->timestamp('timestamp')->useCurrent();
            $table->boolean('is_packed')->default(false);
            $table->timestamp('packed_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // 🔥 INDEXES FOR PERFORMANCE
            // ใช้ตอนดึงออเดอร์ที่ยังไม่ได้แพ็คของเดือนนั้นๆ มาจัดหน้า Dashboard
            $table->index(['is_packed', 'is_active', 'timestamp'], 'idx_order_lookup');
            // ใช้ตอน Query ค้นหาตามช่วงเวลา
            $table->index('timestamp');
        });

        // 2. ตาราง Order Items (แยกจาก JSON มาเป็น Rows เพื่อให้ทำ Index และ Aggregate ง่าย)
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            // foreignId แบบ constrained ช่วยคุม Data Integrity
            $table->foreignId('order_id')->constrained()->onDelete('cascade')->index();
            $table->string('sku', 100);
            $table->integer('quantity')->unsigned();
            $table->decimal('price', 10, 2)->default(0.00);
            $table->timestamps();

            // 🔥 INDEXES FOR PERFORMANCE
            $table->index('sku'); // เผื่อวันหลังอยาก Query ว่า SKU นี้ขายไปได้กี่ชิ้นในเดือนนี้
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
