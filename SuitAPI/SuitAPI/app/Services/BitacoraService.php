<?php

namespace App\Services;

use App\Models\Bitacora;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class BitacoraService
{
    /**
     * Record an action in the bitacora.
     *
     * @param  string  $action  The action performed (e.g., 'created', 'updated', 'deleted').
     * @param  Model  $entity  The model instance being affected.
     * @param  User|null  $user  The user performing the action. If null, Auth::user() is used.
     */
    public function record(string $action, Model $entity, ?User $user = null): void
    {
        $user = $user ?? Auth::user();

        if (! $user) {
            return;
        }

        $entityType = Bitacora::getEntityType(get_class($entity));

        if (! $entityType) {
            // If the entity is not mapped, we don't record it to maintain consistency.
            // Alternatively, we could record get_class($entity), but the user requested a specific string.
            return;
        }

        Bitacora::create([
            'user_id' => $user->id,
            'action' => $action,
            'entity_id' => $entity->getKey(),
            'entity_type' => $entityType,
        ]);
    }
}
