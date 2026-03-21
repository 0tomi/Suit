<?php

namespace App\Policies;

use App\Models\PublicFileCatalog;
use App\Models\User;

class PublicFileCatalogPolicy
{
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
    public function view(User $user, PublicFileCatalog $publicFileCatalog): bool
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
    public function update(User $user, PublicFileCatalog $publicFileCatalog): bool
    {
        if ($publicFileCatalog->name === 'General') {
            return false;
        }

        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, PublicFileCatalog $publicFileCatalog): bool
    {
        if ($publicFileCatalog->name === 'General') {
            return false;
        }

        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, PublicFileCatalog $publicFileCatalog): bool
    {
        if ($publicFileCatalog->name === 'General') {
            return false;
        }

        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, PublicFileCatalog $publicFileCatalog): bool
    {
        if ($publicFileCatalog->name === 'General') {
            return false;
        }

        return $user->isAdmin();
    }
}
