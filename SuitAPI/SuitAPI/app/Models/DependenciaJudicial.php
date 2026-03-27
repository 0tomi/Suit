<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DependenciaJudicial extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory, SoftDeletes;

    protected $table = 'dependencias_judiciales';

    protected $fillable = [
        'jurisdiccion_id',
        'competencia_id',
        'radicacion_id',
        'nombre_juzgado',
    ];

    public function jurisdiccion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Jurisdiccion::class, 'jurisdiccion_id');
    }

    public function competencia(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Competencia::class, 'competencia_id');
    }

    public function radicacion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Radicacion::class, 'radicacion_id');
    }

    public function suitCases(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SuitCase::class, 'dependencia_id');
    }

    /**
     * Get judicial dependencies by jurisdiction.
     */
    public static function getByJurisdiccion(int $jurisdiccionId): \Illuminate\Database\Eloquent\Collection
    {
        return static::query()
            ->where('jurisdiccion_id', $jurisdiccionId)
            ->with('competencia')
            ->get();
    }

    /**
     * Get judicial dependencies by competence.
     */
    public static function getByCompetencia(int $competenciaId): \Illuminate\Database\Eloquent\Collection
    {
        return static::query()
            ->where('competencia_id', $competenciaId)
            ->with('jurisdiccion')
            ->get();
    }
}
