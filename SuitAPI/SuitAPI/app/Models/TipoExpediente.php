<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TipoExpediente extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'titulo',
        'detalles',
        'case_type_id',
    ];

    public function caseType(): BelongsTo
    {
        return $this->belongsTo(CaseType::class, 'case_type_id');
    }

    public function suitCases(): BelongsToMany
    {
        return $this->belongsToMany(SuitCase::class, 'suit_case_tipo_expediente');
    }
}
