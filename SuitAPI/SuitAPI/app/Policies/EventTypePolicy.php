<?php

namespace App\Policies;

use App\Models\EventType;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class EventTypePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $this->isAdmin($user);
    }

    public function update(User $user, EventType $eventType): bool
    {
        return $this->isAdmin($user);
    }

    public function rename(User $user, EventType $eventType): Response
    {
        if (! $this->isAdmin($user)) {
            return Response::deny();
        }

        return $eventType->isDefault()
            ? Response::deny('El tipo de evento "Otro" no puede cambiar su nombre.')
            : Response::allow();
    }

    public function delete(User $user, EventType $eventType): Response
    {
        if (! $this->isAdmin($user)) {
            return Response::deny();
        }

        return $eventType->isDefault()
            ? Response::deny('El tipo de evento "Otro" no puede ser eliminado.')
            : Response::allow();
    }

    private function isAdmin(User $user): bool
    {
        return $user->role === 'admin';
    }
}
