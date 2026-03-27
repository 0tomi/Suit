<?php

namespace App\Policies;

use App\Models\Entrega;
use App\Models\User;

class EntregaPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Entrega $entrega): bool
    {
        return $user->role === 'admin' || $user->id === $entrega->honorario->user_id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['lawyer', 'admin']);
    }

    public function update(User $user, Entrega $entrega): bool
    {
        return $user->role === 'admin' || $user->id === $entrega->honorario->user_id;
    }

    public function delete(User $user, Entrega $entrega): bool
    {
        return $user->role === 'admin' || $user->id === $entrega->honorario->user_id;
    }
}
