<?php

namespace App\Policies;

use App\Models\Setting;
use App\Models\User;

class SettingPolicy
{
    /**
     * Solo los administradores pueden ver o modificar configuraciones del sistema.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, ?Setting $setting = null): bool
    {
        return $user->isAdmin();
    }
}
