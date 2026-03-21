<?php

namespace App\Policies;

use App\Models\CaseType;
use App\Models\User;

class CaseTypePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function update(User $user, CaseType $caseType): bool
    {
        return $user->role === 'admin';
    }

    public function delete(User $user, CaseType $caseType): bool
    {
        return $user->role === 'admin';
    }
}
