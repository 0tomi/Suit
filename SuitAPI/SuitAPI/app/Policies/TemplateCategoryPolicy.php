<?php

namespace App\Policies;

use App\Models\TemplateCategory;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class TemplateCategoryPolicy
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
    public function view(User $user, TemplateCategory $templateCategory): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->role === 'lawyer';
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, TemplateCategory $templateCategory): Response
    {
        if ($templateCategory->isDefault()) {
            return Response::deny('La categoria de plantilla "General" es inmutable.');
        }

        return $user->isAdmin() || $user->role === 'lawyer'
            ? Response::allow()
            : Response::deny();
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, TemplateCategory $templateCategory): Response
    {
        if ($templateCategory->isDefault()) {
            return Response::deny('La categoria de plantilla "General" no puede ser eliminada.');
        }

        return $user->isAdmin() || $user->role === 'lawyer'
            ? Response::allow()
            : Response::deny();
    }
}
