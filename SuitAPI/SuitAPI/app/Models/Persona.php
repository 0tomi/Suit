<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Persona extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVO = 'activo';

    public const STATUS_INACTIVO = 'inactivo';

    protected $fillable = [
        'first_name',
        'last_name',
        'identification_number',
        'email',
        'phone',
        'address',
        'gender',
        'status',
        'notes',
    ];

    protected $casts = [
        'gender' => 'string',
        'status' => 'string',
    ];

    public function getFullNameAttribute(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function partes()
    {
        return $this->hasMany(Parte::class);
    }
}
