<?php

namespace App\Policies;

use App\Models\SuitCase;
use App\Models\User;

class SuitCasePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['lawyer', 'admin']);
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, SuitCase $suitCase): bool
    {
        return $user->role === 'admin' ||
            $user->id === $suitCase->lawyer_id ||
            $suitCase->participants()->where('users.id', $user->id)->exists();
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return in_array($user->role, ['lawyer', 'admin']);
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, SuitCase $suitCase): bool
    {
        if ($user->role === 'admin' || $user->id === $suitCase->lawyer_id) {
            return true;
        }

        $permission = $suitCase->participants()
            ->where('users.id', $user->id)
            ->first()
            ?->pivot
            ->permission_level ?? null;

        return $permission === 'write';
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, SuitCase $suitCase): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine whether the user can close the model.
     */
    public function close(User $user, SuitCase $suitCase): bool
    {
        return $user->role === 'admin' || $user->id === $suitCase->lawyer_id;
    }

    /**
     * Determine whether the user can view the case agenda.
     */
    public function viewAgenda(User $user, SuitCase $suitCase): bool
    {
        return $user->role === 'admin' ||
            $user->id === $suitCase->lawyer_id ||
            $suitCase->participants()->where('users.id', $user->id)->exists();
    }
}
