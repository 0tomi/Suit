<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class GastoSuitCase extends Model
{
    use SoftDeletes;

    protected $table = 'gasto_suit_case';

    protected $fillable = [
        'gasto_id',
        'suit_case_id',
        'user_id',
        'monto',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
        ];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(Gasto::class, 'gasto_id');
    }

    public function suitCase(): BelongsTo
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function clients(): BelongsToMany
    {
        return $this->belongsToMany(Client::class, 'gasto_cliente', 'gasto_suit_case_id', 'client_id')
            ->withTimestamps();
    }

    /** Retorna todos los gastos creados entre dos fechas (inclusivo). */
    public static function getByDateRange(mixed $user, string $from, string $to, ?int $targetUserId = null): \Illuminate\Database\Eloquent\Builder
    {
        return static::query()
            ->with(['type', 'clients'])
            ->whereBetween('created_at', [
                \Illuminate\Support\Carbon::parse($from)->startOfDay(),
                \Illuminate\Support\Carbon::parse($to)->endOfDay(),
            ])
            ->when($user->role !== 'admin', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })
            ->when($user->role === 'admin' && $targetUserId, function ($query) use ($targetUserId) {
                $query->where('user_id', $targetUserId);
            });
    }
}
