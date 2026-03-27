<?php

namespace App\Policies;

use App\Models\GastoSuitCase;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

class GastoSuitCasePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, GastoSuitCase $gasto): bool
    {
        return $user->role === 'admin' || $user->id === $gasto->user_id;
    }

    public function create(User $user): bool
    {
        return false; // Handled by controller checking case-write on the SuitCase
    }

    public function update(User $user, GastoSuitCase $gasto): bool
    {
        return Gate::forUser($user)->allows('case-write', $gasto);
    }

    public function delete(User $user, GastoSuitCase $gasto): bool
    {
        return Gate::forUser($user)->allows('case-write', $gasto);
    }
}
