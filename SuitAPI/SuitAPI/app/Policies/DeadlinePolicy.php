<?php

namespace App\Policies;

use App\Models\Deadline;
use App\Models\User;

class DeadlinePolicy
{
    /**
     * Delega la autorización al EventPolicy a través de la agenda del evento asociado.
     * Si el usuario puede ver/editar la agenda del evento, puede ver/editar el vencimiento.
     */
    public function view(User $user, Deadline $deadline): bool
    {
        return $user->can('view', $deadline->event);
    }

    public function create(User $user): bool
    {
        return true; // Controlled per-request in the controller
    }

    public function update(User $user, Deadline $deadline): bool
    {
        return $user->can('update', $deadline->event);
    }

    public function delete(User $user, Deadline $deadline): bool
    {
        return $user->can('delete', $deadline->event);
    }
}
