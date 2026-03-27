<?php

namespace App\Policies;

use App\Models\Jurisdiccion;
use App\Models\User;

class JurisdiccionPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Jurisdiccion $jurisdiccion): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->role === 'lawyer';
    }

    public function update(User $user, Jurisdiccion $jurisdiccion): bool
    {
        if ($jurisdiccion->nombre === 'Federal') {
            return false;
        }

        return $user->isAdmin() || $user->role === 'lawyer';
    }

    public function delete(User $user, Jurisdiccion $jurisdiccion): bool
    {
        if ($jurisdiccion->nombre === 'Federal') {
            return false;
        }

        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Jurisdiccion $jurisdiccion): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Jurisdiccion $jurisdiccion): bool
    {
        return false;
    }
}
