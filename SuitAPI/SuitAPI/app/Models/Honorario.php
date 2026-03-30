<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Honorario extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'suit_case_id',
        'client_id',
        'user_id',
        'monto',
        'detalles',
        'pagado',
    ];

    protected $attributes = [
        'pagado' => false,
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
            'pagado' => 'boolean',
        ];
    }

    /** Recalcula y persiste el estado pagado segun la suma de entregas. */
    public function recalcularPagado(): void
    {
        $totalEntregas = $this->entregas()->sum('monto');
        $this->update(['pagado' => (float) $totalEntregas >= (float) $this->monto]);
    }

    /** Retorna los honorarios creados entre dos fechas (inclusivo), filtrando por usuario salvo que sea admin o se especifique un user_id (para admins). */
    public static function getByDateRange(User $user, string $from, string $to, ?int $targetUserId = null): \Illuminate\Database\Eloquent\Builder
    {
        return static::query()
            ->with(['client', 'entregas', 'suitCase'])
            ->whereBetween('created_at', [
                \Carbon\Carbon::parse($from)->startOfDay(),
                \Carbon\Carbon::parse($to)->endOfDay(),
            ])
            ->when($targetUserId, function ($query) use ($targetUserId) {
                $query->where('user_id', $targetUserId);
            })
            ->when($user->role !== 'admin', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            });
    }

    public function suitCase(): BelongsTo
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function entregas(): HasMany
    {
        return $this->hasMany(Entrega::class);
    }
}
