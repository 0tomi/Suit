<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentVersion extends Model
{
    protected $fillable = [
        'document_id',
        'version_number',
        'file_path',
        'mime_type',
        'size',
        'encryption_iv',
        'checksum',
        'created_by',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function diffForHumans()
    {
        return $this->created_at->diffForHumans();
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
