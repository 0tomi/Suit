<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Bitacora extends Model
{
    use HasFactory;

    public function entity(): \Illuminate\Database\Eloquent\Relations\MorphTo
    {
        return $this->morphTo()->withTrashed();
    }

    protected $table = 'bitacoras';

    protected $fillable = [
        'user_id',
        'action',
        'entity_id',
        'entity_type',
    ];

    /**
     * The supported entity mappings for Bitacora.
     */
    public const ENTITY_MAPPING = [
        'case' => \App\Models\SuitCase::class,
        'client' => \App\Models\Client::class,
        'document' => \App\Models\Document::class,
        'agenda' => \App\Models\Agenda::class,
        'event' => \App\Models\Event::class,
        'user' => \App\Models\User::class,
        'multimedia' => \App\Models\Multimedia::class,
        'public_file' => \App\Models\PublicFile::class,
        'file' => \App\Models\File::class,
        'role' => \App\Models\Rol::class,
        'jurisdiction' => \App\Models\Jurisdiccion::class,
        'competency' => \App\Models\Competencia::class,
        'judicial_dependency' => \App\Models\DependenciaJudicial::class,
        'tax' => \App\Models\Gasto::class,
        'fee' => \App\Models\Honorario::class,
        'delivery' => \App\Models\Entrega::class,
        'radicacion' => \App\Models\Radicacion::class,
        'tombstone' => \App\Models\Tombstone::class,
    ];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the mapped class name for an entity type string.
     */
    public static function getEntityClass(string $type): ?string
    {
        return self::ENTITY_MAPPING[$type] ?? null;
    }

    /**
     * Get the entity type string for a class name.
     */
    public static function getEntityType(string $class): ?string
    {
        return array_search($class, self::ENTITY_MAPPING, true) ?: null;
    }
}
