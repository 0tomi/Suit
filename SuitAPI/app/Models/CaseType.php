<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CaseType extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'eventColor'];

    public function suitCases()
    {
        return $this->hasMany(SuitCase::class);
    }

    public function tipoExpedientes()
    {
        return $this->hasMany(TipoExpediente::class, 'case_type_id');
    }
}
