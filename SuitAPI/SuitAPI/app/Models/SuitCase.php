<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SuitCase extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'title',
        'lawyer_id',
        'status',
        'case_type_id',
        'start_date',
        'end_date',
        'details',
        'nro_expediente',
        'radicacion_id',
        'dependencia_id',
    ];

    protected $hidden = [
        'lawyer_id',
        'creator',
    ];

    protected $appends = [
        'owner_tag',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'lawyer_id');
    }

    public function getOwnerTagAttribute(): ?string
    {
        return $this->creator?->tag;
    }

    public function participants()
    {
        return $this->belongsToMany(User::class, 'case_permissions')
            ->using(CasePermission::class)
            ->withPivot('permission_level')
            ->withTimestamps();
    }

    /**
     * Get all participants including the owner (lawyer) with a virtual permission_level.
     *
     * @return \Illuminate\Support\Collection<int, User>
     */
    public function getAllParticipantsAttribute(): \Illuminate\Support\Collection
    {
        $owner = $this->creator;
        $owner->setAttribute('permission_level', 'owner');

        $participants = $this->participants->map(function (User $user) {
            $user->setAttribute('permission_level', $user->pivot->permission_level);

            return $user;
        });

        return collect([$owner])->merge($participants);
    }

    public function agenda()
    {
        return $this->hasOne(Agenda::class);
    }

    public function permissions()
    {
        return $this->hasMany(CasePermission::class);
    }

    public function events()
    {
        return $this->hasMany(Event::class);
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    public function multimedia()
    {
        return $this->hasMany(Multimedia::class);
    }

    public function files()
    {
        return $this->hasMany(File::class);
    }

    public function type()
    {
        return $this->belongsTo(CaseType::class, 'case_type_id');
    }

    public function clients()
    {
        return $this->belongsToMany(Client::class, 'case_client', 'suit_case_id', 'client_id')
            ->withTimestamps();
    }

    public function partes()
    {
        return $this->belongsToMany(Parte::class, 'parte_caso')
            ->withTimestamps();
    }

    public function radicacion()
    {
        return $this->belongsTo(Radicacion::class, 'radicacion_id');
    }

    public function dependenciaJudicial()
    {
        return $this->belongsTo(DependenciaJudicial::class, 'dependencia_id');
    }

    public function tipoExpedientes()
    {
        return $this->belongsToMany(TipoExpediente::class, 'suit_case_tipo_expediente')
            ->withTimestamps();
    }

    public function honorarios()
    {
        return $this->hasMany(Honorario::class);
    }

    public function gastos()
    {
        return $this->hasMany(GastoSuitCase::class, 'suit_case_id');
    }

    /**
     * Get the last modification date across all cases accessible by the user.
     */
    public static function getLastModifiedForUser(User $user)
    {
        if ($user->role === 'admin') {
            return static::max('updated_at');
        }

        return static::where('lawyer_id', $user->id)
            ->orWhereHas('participants', function ($q) use ($user) {
                $q->where('users.id', $user->id);
            })
            ->max('updated_at');
    }

    /**
     * Scope to limit cases to those accessible by a specific user.
     */
    public function scopeAccessibleBy($query, User $user)
    {
        if ($user->role !== 'admin') {
            $query->where(function ($q) use ($user) {
                $q->where('lawyer_id', $user->id)
                    ->orWhereHas('participants', function ($sq) use ($user) {
                        $sq->where('users.id', $user->id);
                    });
            });
        }
    }

    /**
     * Scope to limit cases by status.
     */
    public function scopeOfStatus($query, ?string $status)
    {
        if ($status !== null) {
            $query->where('status', $status);
        }
    }

    /** Recalcula el estado de todos los clientes asociados a este caso. */
    public function recalculateClientsStatus(): void
    {
        $this->clients->each->recalculateStatus();
    }
}
