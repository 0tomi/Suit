<?php

namespace App\Policies;

use App\Models\TipoExpediente;
use App\Models\User;

class TipoExpedientePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, TipoExpediente $tipoExpediente): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function update(User $user, TipoExpediente $tipoExpediente): bool
    {
        return $user->role === 'admin';
    }

    public function delete(User $user, TipoExpediente $tipoExpediente): bool
    {
        return $user->role === 'admin';
    }
}
