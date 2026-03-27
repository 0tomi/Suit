<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Radicacion extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory, SoftDeletes;

    protected $table = 'radicaciones';

    protected $fillable = [
        'tipo',
    ];

    protected static function booted(): void
    {
        static::updating(function ($model) {
            if ($model->getOriginal('tipo') === 'Federal') {
                abort(403, 'El registro Federal no puede ser modificado.');
            }
        });

        static::deleting(function ($model) {
            if ($model->tipo === 'Federal') {
                abort(403, 'El registro Federal no puede ser eliminado.');
            }
        });
    }

    public function suitCases(): HasMany
    {
        return $this->hasMany(SuitCase::class, 'radicacion_id');
    }
}
