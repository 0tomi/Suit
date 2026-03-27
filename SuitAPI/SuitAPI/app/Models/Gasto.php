<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Gasto extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'titulo',
        'detalles',
    ];

    public function suitCaseEntries(): HasMany
    {
        return $this->hasMany(GastoSuitCase::class, 'gasto_id');
    }

    public function suitCases(): BelongsToMany
    {
        return $this->belongsToMany(SuitCase::class, 'gasto_suit_case', 'gasto_id', 'suit_case_id')
            ->withPivot('id', 'monto')
            ->withTimestamps();
    }
}
