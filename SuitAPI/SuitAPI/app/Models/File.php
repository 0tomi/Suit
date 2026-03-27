<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class File extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'filename',
        'path',
        'hash',
        'mime_type',
        'size',
        'encryption_iv',
        'suit_case_id',
        'user_id',
        'updated_by',
    ];

    public function suitCase()
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function updatedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    protected static function booted(): void
    {
        static::saving(function (File $file) {
            if (auth()->check()) {
                $file->updated_by = auth()->id();
            }
        });
    }
}
