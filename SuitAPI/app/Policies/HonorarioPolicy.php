<?php

namespace App\Policies;

use App\Models\Honorario;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

class HonorarioPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Honorario $honorario): bool
    {
        return $user->role === 'admin' || $user->id === $honorario->user_id;
    }

    public function create(User $user): bool
    {
        return false; // Handled by controller checking case-write on the SuitCase
    }

    public function update(User $user, Honorario $honorario): bool
    {
        return Gate::forUser($user)->allows('case-write', $honorario);
    }

    public function delete(User $user, Honorario $honorario): bool
    {
        return Gate::forUser($user)->allows('case-write', $honorario);
    }
}
