<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PublicFile extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'user_id',
        'name',
        'path',
        'mime_type',
        'size',
        'hash',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the route key for the model.
     *
     * @return string
     */
    public function getRouteKeyName()
    {
        return 'id';
    }

    public function catalog(): BelongsTo
    {
        return $this->belongsTo(PublicFileCatalog::class, 'public_file_catalog_id');
    }

    public function permissions()
    {
        return $this->hasMany(PublicFilePermission::class);
    }

    protected static function booted(): void
    {
        static::creating(function (PublicFile $publicFile) {
            if ($publicFile->public_file_catalog_id === null) {
                $generalCatalog = PublicFileCatalog::where('name', 'General')->first();
                if ($generalCatalog) {
                    $publicFile->public_file_catalog_id = $generalCatalog->id;
                }
            }
        });
    }
}
