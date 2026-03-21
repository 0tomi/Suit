<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Radicacion extends Model
{
    use SoftDeletes, \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $table = 'radicaciones';

    protected $fillable = [
        'nombre_lugar',
    ];

    public function suitCases(): HasMany
    {
        return $this->hasMany(SuitCase::class, 'radicacion_id');
    }
}
