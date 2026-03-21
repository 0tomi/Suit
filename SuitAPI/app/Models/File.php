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
    ];

    public function suitCase()
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
