<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlantillaRequisito extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'plantilla_requisitos';

    // Laravel doesn't support composite primary keys natively for all operations,
    // so we set incrementing to false and provide some helpers if needed.
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'template_id',
        'requisito_id',
        'id_campo',
        'NEntidad',
        'note',
    ];

    public function template()
    {
        return $this->belongsTo(Template::class);
    }

    public function requisito()
    {
        return $this->belongsTo(Requisito::class);
    }

    /**
     * Devuelve todos los requisitos para una Template,
     * devolviendo el id_campo y la id de cada requisito.
     */
    public static function getRequirementsForTemplate(int $templateId)
    {
        return self::where('template_id', $templateId)
            ->select('id_campo', 'requisito_id', 'NEntidad', 'note')
            ->get();
    }
}
