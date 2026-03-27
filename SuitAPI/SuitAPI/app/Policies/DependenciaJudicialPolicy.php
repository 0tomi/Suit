<?php

namespace App\Policies;

use App\Models\DependenciaJudicial;
use App\Models\User;

class DependenciaJudicialPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, DependenciaJudicial $dependenciaJudicial): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->role === 'lawyer';
    }

    public function update(User $user, DependenciaJudicial $dependenciaJudicial): bool
    {
        return $user->isAdmin() || $user->role === 'lawyer';
    }

    public function delete(User $user, DependenciaJudicial $dependenciaJudicial): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, DependenciaJudicial $dependenciaJudicial): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, DependenciaJudicial $dependenciaJudicial): bool
    {
        return false;
    }
}
