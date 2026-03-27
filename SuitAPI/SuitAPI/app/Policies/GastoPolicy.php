<?php

namespace App\Policies;

use App\Models\Gasto;
use App\Models\User;

class GastoPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Gasto $gasto): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function update(User $user, Gasto $gasto): bool
    {
        return $user->role === 'admin';
    }

    public function delete(User $user, Gasto $gasto): bool
    {
        return $user->role === 'admin';
    }
}
