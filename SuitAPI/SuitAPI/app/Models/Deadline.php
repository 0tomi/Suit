<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Deadline extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'Pendiente';

    public const STATUS_OVERDUE = 'Vencido';

    public const STATUS_EXTENDED = 'Prorrogado';

    public const STATUS_COMPLETED = 'Cumplido';

    public const PRIORITY_NORMAL = 'Normal';

    public const PRIORITY_URGENT = 'Urgente';

    /** Clave de Settings para los días de umbral de urgencia automática. */
    public const SETTING_URGENCY_DAYS = 'deadline_urgency_days';

    /** Valor por defecto si la setting no existe en BD. */
    private const DEFAULT_URGENCY_DAYS = 2;

    protected $fillable = [
        'event_id',
        'title',
        'description',
        'due_date',
        'priority',
        'manually_urgent',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'datetime',
            'manually_urgent' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Deadline $deadline): void {
            Tombstone::record(Tombstone::TYPE_DEADLINE, $deadline->id);
        });
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    /**
     * Infiere y persiste el estado/prioridad del vencimiento según la fecha actual.
     *
     * Reglas:
     *  - 'Cumplido' es terminal: nunca se modifica automáticamente.
     *  - Si la fecha no pasó (antes de las 23:59 del due_date):
     *    - El estado se mantiene como Pendiente o Prorrogado según lo que ya tenía.
     *    - Si quedan ≤ N días (configurable), la prioridad se eleva a Urgente.
     *    - Si el vencimiento fue marcado manualmente como Urgente (`manually_urgent=true`),
     *      no se degrada nunca a Normal, independientemente del tiempo restante.
     *  - Si la fecha pasó y el estado era 'Pendiente' o 'Prorrogado' → 'Vencido'.
     */
    public function inferState(): static
    {
        if ($this->status === self::STATUS_COMPLETED) {
            return $this;
        }

        // Si la hora es exactamente medianoche, asumimos comportamiento "todo el día" (vence a las 23:59:59).
        // Si tiene una hora específica, usamos esa precisión para el vencimiento.
        $dueDate = Carbon::parse($this->due_date);
        $thresholdDate = $dueDate->isMidnight() ? $dueDate->copy()->endOfDay() : $dueDate;

        $urgencyDays = (int) Setting::get(self::SETTING_URGENCY_DAYS, self::DEFAULT_URGENCY_DAYS);

        if (now()->lte($thresholdDate)) {
            if ($this->status === self::STATUS_OVERDUE) {
                $this->status = self::STATUS_PENDING;
            }

            // Para la urgencia usamos precisión horaria si queremos ser estrictos con el umbral.
            $hoursUntilDue = now()->diffInHours($thresholdDate, false);
            $urgencyThresholdHours = $urgencyDays * 24;

            if ($hoursUntilDue <= $urgencyThresholdHours) {
                $this->priority = self::PRIORITY_URGENT;
            } elseif (! $this->manually_urgent) {
                $this->priority = self::PRIORITY_NORMAL;
            }
        } else {
            if (in_array($this->status, [self::STATUS_PENDING, self::STATUS_EXTENDED])) {
                $this->status = self::STATUS_OVERDUE;
            }
        }

        $this->saveQuietly();

        return $this;
    }

    /**
     * Obtiene todos los vencimientos de un mes/año concretos,
     * filtrando según las agendas accesibles por el usuario.
     *
     * @param  int[]  $agendaIds
     */
    public static function forMonthInAgendas(int $month, int $year, array $agendaIds): \Illuminate\Database\Eloquent\Collection
    {
        $start = \Illuminate\Support\Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        return static::query()
            ->whereHas('event', fn ($q) => $q->whereIn('agenda_id', $agendaIds))
            ->whereBetween('due_date', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->with('event')
            ->get();
    }
}
