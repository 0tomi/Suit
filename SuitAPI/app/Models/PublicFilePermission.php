<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublicFilePermission extends Model
{
    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = [
        'public_file_id',
        'user_id',
        'can_update',
        'can_delete',
    ];

    protected function casts(): array
    {
        return [
            'can_update' => 'boolean',
            'can_delete' => 'boolean',
        ];
    }

    public function publicFile()
    {
        return $this->belongsTo(PublicFile::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
