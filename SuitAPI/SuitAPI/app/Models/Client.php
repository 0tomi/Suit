<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_ACTIVO = Persona::STATUS_ACTIVO;

    public const STATUS_INACTIVO = Persona::STATUS_INACTIVO;

    public const FINANCIAL_NO_DEUDOR = 'no deudor';

    public const FINANCIAL_DEUDOR = 'deudor';

    public const FINANCIAL_MOROSO = 'moroso';

    protected $fillable = [
        'type',
        'financial_status',
        'persona_id',
    ];

    protected $casts = [
        'type' => 'string',
        'financial_status' => 'string',
    ];

    public function persona()
    {
        return $this->belongsTo(Persona::class);
    }

    /** Recalcula el estado (activo/inactivo) según sus casos asociados. */
    public function recalculateStatus(): void
    {
        // Forzamos el uso de la tabla suit_cases para evitar ambigüedades
        $hasActiveCases = $this->cases()
            ->where('suit_cases.status', 'active')
            ->whereNull('suit_cases.deleted_at')
            ->exists();

        if ($this->persona) {
            $this->persona->status = $hasActiveCases ? Persona::STATUS_ACTIVO : Persona::STATUS_INACTIVO;
            $this->persona->save();
        }
    }

    /** Recalcula el estado financiero (no deudor/deudor/moroso) según sus honorarios. */
    public function recalculateFinancialStatus(): void
    {
        $thresholdDays = (int) Setting::get('client_moroso_threshold_days', '30');

        // Obtenemos honorarios no pagados directamente de la base de datos
        $unpaidHonorarios = $this->honorarios()
            ->where('pagado', false)
            ->whereNull('deleted_at')
            ->get();

        if ($unpaidHonorarios->isEmpty()) {
            $this->financial_status = self::FINANCIAL_NO_DEUDOR;
            $this->save();

            return;
        }

        $hasMora = $unpaidHonorarios->contains(function ($honorario) use ($thresholdDays) {
            return $honorario->created_at->diffInDays(now()) >= $thresholdDays;
        });

        $this->financial_status = $hasMora ? self::FINANCIAL_MOROSO : self::FINANCIAL_DEUDOR;
        $this->save();
    }

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
