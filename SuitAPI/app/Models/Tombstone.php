<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Generic tombstone registry for hard-deleted resources.
 * When a model is hard-deleted, it records its type and ID here so that
 * sync clients can detect the deletion during incremental (delta) syncs.
 */
class Tombstone extends Model
{
    public $timestamps = false;

    public const TYPE_TEMPLATE = 'template';

    public const TYPE_TEMPLATE_CATEGORY = 'template_category';

    public const TYPE_DEADLINE = 'deadline';

    protected $fillable = ['resource_type', 'resource_id', 'deleted_at'];

    protected function casts(): array
    {
        return [
            'deleted_at' => 'datetime',
        ];
    }

    /** Record a tombstone for the given resource type and ID. */
    public static function record(string $resourceType, int $resourceId): void
    {
        static::create([
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'deleted_at' => now(),
        ]);
    }

    /** Get IDs of resources of the given type deleted at or after $since. */
    public static function deletedSince(string $resourceType, Carbon $since): Collection
    {
        return static::where('resource_type', $resourceType)
            ->where('deleted_at', '>=', $since)
            ->pluck('resource_id');
    }
}
