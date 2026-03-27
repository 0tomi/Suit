<?php

namespace App\Policies;

use App\Models\Rol;
use App\Models\User;

class RolPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Rol $rol): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'lawyer']);
    }

    public function update(User $user, Rol $rol): bool
    {
        return in_array($user->role, ['admin', 'lawyer']);
    }

    public function delete(User $user, Rol $rol): bool
    {
        return in_array($user->role, ['admin', 'lawyer']);
    }
}
