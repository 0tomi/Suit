<?php

namespace App\Policies;

use App\Models\PublicFile;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PublicFilePolicy
{
    use HandlesAuthorization;

    public function before(User $user, string $ability): ?bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return null;
    }

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, PublicFile $publicFile): bool
    {
        return true;
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
    public function update(User $user, PublicFile $publicFile): bool
    {
        return $user->id === $publicFile->user_id || $publicFile->permissions()->where('user_id', $user->id)->where('can_update', true)->exists();
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, PublicFile $publicFile): bool
    {
        return $user->id === $publicFile->user_id || $publicFile->permissions()->where('user_id', $user->id)->where('can_delete', true)->exists();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, PublicFile $publicFile): bool
    {
        return $user->id === $publicFile->user_id;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, PublicFile $publicFile): bool
    {
        return $user->id === $publicFile->user_id;
    }
}
