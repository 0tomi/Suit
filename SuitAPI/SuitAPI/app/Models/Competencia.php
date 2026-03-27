<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Competencia extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory, SoftDeletes;

    protected $table = 'competencias';

    protected $fillable = [
        'fuero',
    ];

    public function dependenciasJudiciales(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DependenciaJudicial::class, 'competencia_id');
    }
}
