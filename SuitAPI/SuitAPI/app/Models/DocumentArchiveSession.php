<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentArchiveSession extends Model
{
    protected $fillable = [
        'document_id',
        'extracted_path',
        'archive_path',
        'keep_until',
    ];

    protected function casts(): array
    {
        return [
            'keep_until' => 'datetime',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /** Sessions where the keep_until window has already passed. */
    public function scopeExpired($query): mixed
    {
        return $query->where('keep_until', '<', now());
    }

    /** Whether the extracted files should still be on disk. */
    public function isActive(): bool
    {
        return $this->keep_until->isFuture();
    }
}
