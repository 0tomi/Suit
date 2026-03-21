<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Facades\DB;

class CasePermission extends Pivot
{
    public $incrementing = true;

    protected $table = 'case_permissions';

    protected $fillable = ['suit_case_id', 'user_id', 'permission_level'];

    protected static function booted(): void
    {
        static::created(function (CasePermission $permission) {
            $permission->grantAgendaAccess();
        });

        static::updated(function (CasePermission $permission) {
            $permission->touchAgendaAccess();
        });

        static::deleted(function (CasePermission $permission) {
            $permission->revokeAgendaAccess();
        });
    }

    public function suitCase()
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function grantAgendaAccess(): void
    {
        $agenda = $this->suitCase?->agenda;

        if (! $agenda) {
            return;
        }

        $agenda->users()->syncWithoutDetaching([
            $this->user_id => [
                'created_at' => $this->created_at ?? now(),
                'updated_at' => $this->updated_at ?? now(),
            ],
        ]);
    }

    public function touchAgendaAccess(): void
    {
        $agenda = $this->suitCase?->agenda;

        if (! $agenda || ! $agenda->users()->where('users.id', $this->user_id)->exists()) {
            return;
        }

        $agenda->users()->updateExistingPivot($this->user_id, [
            'updated_at' => now(),
        ]);
    }

    public function revokeAgendaAccess(): void
    {
        $agenda = $this->suitCase?->agenda;

        if (! $agenda || $agenda->user_id === $this->user_id) {
            return;
        }

        $agenda->users()->detach($this->user_id);

        DB::table('agenda_user')
            ->where('user_id', $this->user_id)
            ->update(['updated_at' => now()]);
    }
}
