<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Requisito extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = ['type', 'title'];

    public function templates()
    {
        return $this->belongsToMany(Template::class, 'plantilla_requisitos', 'requisito_id', 'template_id')
            ->withPivot('id_campo')
            ->withTimestamps();
    }
}
