<?php

namespace App\Policies;

use App\Models\Competencia;
use App\Models\User;

class CompetenciaPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Competencia $competencia): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->role === 'lawyer';
    }

    public function update(User $user, Competencia $competencia): bool
    {
        return $user->isAdmin() || $user->role === 'lawyer';
    }

    public function delete(User $user, Competencia $competencia): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Competencia $competencia): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Competencia $competencia): bool
    {
        return false;
    }
}
