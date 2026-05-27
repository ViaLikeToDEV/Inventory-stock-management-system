<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Variant extends Model
{
    protected $primaryKey = 'sku';
    public $incrementing = false;      // PK เป็น string
    protected $keyType = 'string';     // บอก Eloquent ว่า PK ไม่ใช่ int

    protected $fillable = [
        'sku',
        'product_id',
        'variant_name',
        'barcode',
    ];

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'product_id');
    }
}
