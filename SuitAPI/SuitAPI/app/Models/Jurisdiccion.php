<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

// Assuming DependenciaJudicial is in the same namespace or needs to be imported

class Jurisdiccion extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory, SoftDeletes;

    protected $table = 'jurisdicciones';

    protected $fillable = [
        'nombre',
    ];

    protected static function booted(): void
    {
        static::updating(function ($model) {
            if ($model->getOriginal('nombre') === 'Federal') {
                abort(403, 'El registro Federal no puede ser modificado.');
            }
        });

        static::deleting(function ($model) {
            if ($model->nombre === 'Federal') {
                abort(403, 'El registro Federal no puede ser eliminado.');
            }
        });
    }

    public function dependenciasJudiciales(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DependenciaJudicial::class, 'jurisdiccion_id');
    }

    /**
     * Get unique competencies available in this jurisdiction.
     */
    public function getCompetenciasAttribute(): \Illuminate\Support\Collection
    {
        return $this->dependenciasJudiciales()
            ->with('competencia')
            ->get()
            ->pluck('competencia')
            ->unique('id')
            ->values();
    }
}
