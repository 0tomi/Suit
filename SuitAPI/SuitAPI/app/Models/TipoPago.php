<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TipoPago extends Model
{
    use SoftDeletes;

    protected $table = 'tipo_pagos';

    protected $fillable = [
        'titulo',
        'detalles',
    ];

    public function entregas(): HasMany
    {
        return $this->hasMany(Entrega::class, 'tipo_pago_id');
    }
}
