<?php

namespace App\Policies;

use App\Models\Agenda;
use App\Models\User;

class AgendaPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true; // Users can see their own list, filtering happens in Controller
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Agenda $agenda): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return $user->accessibleAgendas()->whereKey($agenda->id)->exists();
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Agenda $agenda): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($agenda->user_id === $user->id) {
            return true;
        }

        if ($agenda->suit_case_id) {
            $permission = $user->casePermissions()
                ->where('suit_case_id', $agenda->suit_case_id)
                ->first();

            return $permission?->permission_level === 'write';
        }

        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Agenda $agenda): bool
    {
        return $this->update($user, $agenda);
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Agenda $agenda): bool
    {
        return $this->update($user, $agenda);
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Agenda $agenda): bool
    {
        return $this->update($user, $agenda);
    }
}
