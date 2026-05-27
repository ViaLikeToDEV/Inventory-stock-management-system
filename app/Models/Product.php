<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $primaryKey = 'product_id';
    public $incrementing = false; // product_id มาจาก Sheet ไม่ใช่ auto-increment

    protected $fillable = [
        'product_id',
        'product_name',
    ];

    public function variants(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Variant::class, 'product_id', 'product_id');
    }
}
