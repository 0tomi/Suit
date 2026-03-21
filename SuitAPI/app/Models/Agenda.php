<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Agenda extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'user_id', 'suit_case_id'];

    protected static function booted(): void
    {
        static::created(function (Agenda $agenda) {
            $agenda->syncAccessibleUsers();
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function suitCase()
    {
        return $this->belongsTo(SuitCase::class, 'suit_case_id');
    }

    public function events()
    {
        return $this->hasMany(Event::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'agenda_user')->withTimestamps();
    }

    public function scopeAccessibleBy($query, User $user)
    {
        if ($user->role === 'admin') {
            return $query;
        }

        return $query->whereHas('users', function ($accessQuery) use ($user) {
            $accessQuery->where('users.id', $user->id);
        });
    }

    public function syncAccessibleUsers(): void
    {
        $userIds = collect([$this->user_id]);

        if ($this->suit_case_id) {
            $this->loadMissing('suitCase.participants');

            if ($this->suitCase) {
                $userIds = $userIds
                    ->push($this->suitCase->lawyer_id)
                    ->merge($this->suitCase->participants->pluck('id'));
            }
        }

        $userIds = $userIds
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($userIds !== []) {
            $this->users()->syncWithoutDetaching($userIds);
        }
    }

    /**
     * Get the last modification date across the agendas currently accessible to the user.
     * Includes permission updates so newly shared case agendas can be detected.
     */
    public static function getLastModifiedForUser(User $user)
    {
        if ($user->role === 'admin') {
            $agendaLastModified = static::query()->max('updated_at');
            $accessLastModified = \Illuminate\Support\Facades\DB::table('agenda_user')->max('updated_at');

            return collect([$agendaLastModified, $accessLastModified])
                ->filter()
                ->map(fn ($timestamp) => \Illuminate\Support\Carbon::parse($timestamp))
                ->max();
        }

        $agendaLastModified = $user->accessibleAgendas()->max('agendas.updated_at');
        $accessLastModified = $user->accessibleAgendas()->max('agenda_user.updated_at');

        return collect([$agendaLastModified, $accessLastModified])
            ->filter()
            ->map(fn ($timestamp) => \Illuminate\Support\Carbon::parse($timestamp))
            ->max();
    }
}
