<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

class DocumentPolicy
{
    /**
     * Determine whether the user can view the document.
     */
    public function view(User $user, Document $document): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        // If the document belongs to a suit case, access is determined by case participation
        if ($document->suit_case_id) {
            $case = $document->suitCase;

            // Lawyer (owner) of the case always has access
            if ($case && $case->lawyer_id === $user->id) {
                return true;
            }

            // Participants of the case have access
            return $case && $case->participants()
                ->where('users.id', $user->id)
                ->exists();
        }

        // If the document does NOT belong to a case, only the owner can see it
        return $user->id === $document->user_id;
    }

    /**
     * Determine whether the user can create documents.
     */
    public function create(User $user, ?\App\Models\SuitCase $suitCase = null): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        // If no case is specified, it's a personal document, so allow.
        if (! $suitCase) {
            return true;
        }

        // If a case is specified, check if the user is the owner (lawyer)
        if ($suitCase->lawyer_id === $user->id) {
            return true;
        }

        // Or if the user is a participant with 'write' permission
        return $suitCase->participants()
            ->where('users.id', $user->id)
            ->wherePivot('permission_level', 'write')
            ->exists();
    }

    /**
     * Determine whether the user can update the document (content, name, status)
     * or associate/disassociate clients. Requires write-level access.
     */
    public function update(User $user, Document $document): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($user->id === $document->user_id) {
            return true;
        }

        if ($document->suit_case_id) {
            $case = $document->suitCase;

            if ($case && $case->lawyer_id === $user->id) {
                return true;
            }

            // Participants must have explicit write permission to modify documents.
            return $case && $case->participants()
                ->where('users.id', $user->id)
                ->wherePivot('permission_level', 'write')
                ->exists();
        }

        return false;
    }

    /**
     * Determine whether the user can delete the document.
     */
    public function delete(User $user, Document $document): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        // Without a case, only the owner can delete
        if (! $document->suit_case_id) {
            return $user->id === $document->user_id;
        }

        // With a case, owner (lawyer) of the case or participant with 'write' can delete
        $case = $document->suitCase;
        if ($case && $case->lawyer_id === $user->id) {
            return true;
        }

        return $case && $case->participants()
            ->where('users.id', $user->id)
            ->wherePivot('permission_level', 'write')
            ->exists();
    }
}
