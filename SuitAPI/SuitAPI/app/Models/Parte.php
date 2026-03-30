<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Parte extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'rol_id',
        'persona_id',
    ];

    public function persona(): BelongsTo
    {
        return $this->belongsTo(Persona::class);
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class);
    }

    public function suitCases(): BelongsToMany
    {
        return $this->belongsToMany(SuitCase::class, 'parte_caso')
            ->withTimestamps();
    }
}
