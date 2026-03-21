<?php

namespace App\Policies;

use App\Models\TipoPago;
use App\Models\User;

class TipoPagoPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, TipoPago $tipoPago): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function update(User $user, TipoPago $tipoPago): bool
    {
        return $user->role === 'admin';
    }

    public function delete(User $user, TipoPago $tipoPago): bool
    {
        return $user->role === 'admin';
    }
}
