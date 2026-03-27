<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    /** @use HasFactory<\Database\Factories\ClientFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'first_name',
        'last_name',
        'identification_number',
        'email',
        'phone',
        'address',
        'type',
        'status',
        'notes',
        'gender',
    ];

    protected $casts = [
        'type' => 'string',
        'status' => 'string',
        'gender' => 'string',
    ];

    public function cases()
    {
        return $this->belongsToMany(SuitCase::class, 'case_client', 'client_id', 'suit_case_id')
            ->withTimestamps();
    }

    public function documents()
    {
        return $this->belongsToMany(Document::class, 'document_client', 'client_id', 'document_id')
            ->withTimestamps();
    }

    public function honorarios()
    {
        return $this->hasMany(Honorario::class);
    }

    public function gastos()
    {
        return $this->belongsToMany(GastoSuitCase::class, 'gasto_cliente', 'client_id', 'gasto_suit_case_id')
            ->withTimestamps();
    }
}
