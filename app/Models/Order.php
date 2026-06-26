<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'tracking_number',
        'order_sn',
        'timestamp',
        'is_packed',
        'packed_at',
        'is_active',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'packed_at' => 'datetime',
        'is_packed' => 'boolean',
        'is_active' => 'boolean',
    ];

    // Relationship to Items
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    // 🚀 Local Scope สำหรับ Query ออเดอร์ที่ต้องแพ็คด่วน (ตัวช่วยให้ Code สะอาดและเร็ว)
    public function scopePendingPack($query)
    {
        return $query->where('is_packed', false)
                     ->where('is_active', true);
    }
}
