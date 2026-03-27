<?php

namespace App\Policies;

use App\Models\Parte;
use App\Models\User;

class PartePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Parte $parte): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'lawyer']);
    }

    public function update(User $user, Parte $parte): bool
    {
        return in_array($user->role, ['admin', 'lawyer']);
    }

    public function delete(User $user, Parte $parte): bool
    {
        return in_array($user->role, ['admin', 'lawyer']);
    }
}
