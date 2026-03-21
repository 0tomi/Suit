<?php

namespace App\Policies;

use App\Models\Radicacion;
use App\Models\User;

class RadicacionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Radicacion $radicacion): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['lawyer', 'admin']);
    }

    public function update(User $user, Radicacion $radicacion): bool
    {
        return in_array($user->role, ['lawyer', 'admin']);
    }

    public function delete(User $user, Radicacion $radicacion): bool
    {
        return in_array($user->role, ['lawyer', 'admin']);
    }
}
