<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'category',
        'user_id',
        'suit_case_id',
        'event_id',
        'is_locked',
        'locked_by',
        'locked_at',
    ];

    /**
     * When a document is updated, touch its parent case so clients
     * can detect changes in their case data via last-modified.
     */
    protected $touches = ['suitCase'];

    protected $casts = [
        'is_locked' => 'boolean',
        'locked_at' => 'datetime',
    ];

    // Relationships
    public function versions()
    {
        return $this->hasMany(DocumentVersion::class);
    }

    public function latestVersion()
    {
        return $this->hasOne(DocumentVersion::class)->latestOfMany('version_number');
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function suitCase()
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function locker()
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function clients()
    {
        return $this->belongsToMany(Client::class, 'document_client', 'document_id', 'client_id')
            ->withTimestamps();
    }

    // Lock Helper Methods
    public function isLocked(): bool
    {
        if (! $this->is_locked) {
            return false;
        }

        // Check if lock has expired (5 minutes)
        if ($this->locked_at && $this->locked_at->diffInMinutes(Carbon::now()) >= 5) {
            return false;
        }

        return true;
    }

    public function lock(User $user): bool
    {
        if ($user->role !== 'admin' && $this->isLocked() && $this->locked_by !== $user->id) {
            return false;
        }

        $this->update([
            'is_locked' => true,
            'locked_by' => $user->id,
            'locked_at' => Carbon::now(),
        ]);

        return true;
    }

    public function unlock(User $user): bool
    {
        // Only the locker or an admin could unlock
        if ($user->role !== 'admin' && $this->locked_by !== $user->id) {
            return false;
        }

        $this->update([
            'is_locked' => false,
            'locked_by' => null,
            'locked_at' => null,
        ]);

        return true;
    }

    /**
     * Scope to filter documents accessible by a specific user.
     *
     * Rules:
     * 1. Document has no case AND user is owner.
     * 2. Document belongs to a case AND user is lawyer/creator OR participant.
     */
    public function scopeAccessibleBy($query, User $user)
    {
        if ($user->role === 'admin') {
            return $query;
        }

        return $query->where(function ($q) use ($user) {
            // Option 1: Personal document without a case
            $q->where(function ($sub) use ($user) {
                $sub->where('user_id', $user->id)
                    ->whereNull('suit_case_id');
            })
                // Option 2: Document related to a case where user is involved
                ->orWhereHas('suitCase', function ($caseQ) use ($user) {
                    $caseQ->where(function ($cq) use ($user) {
                        $cq->where('lawyer_id', $user->id) // User is the lawyer/owner of the case
                            ->orWhereHas('participants', function ($partQ) use ($user) {
                                $partQ->where('users.id', $user->id); // User is a participant
                            });
                    });
                });
        });
    }
}
