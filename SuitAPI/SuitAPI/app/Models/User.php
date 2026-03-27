<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'last_name',
        'tag',
        'email',
        'password',
        'role',
        'profile_photo_path',
    ];

    protected $appends = ['profile_photo_url'];

    public function getProfilePhotoUrlAttribute(): ?string
    {
        if (! $this->profile_photo_path) {
            return null;
        }

        return url('storage/'.$this->profile_photo_path);
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function personalAgenda()
    {
        return $this->hasOne(Agenda::class)->whereNull('suit_case_id');
    }

    public function accessibleAgendas()
    {
        return $this->belongsToMany(Agenda::class, 'agenda_user')->withTimestamps();
    }

    public function ownedCases()
    {
        return $this->hasMany(SuitCase::class, 'lawyer_id');
    }

    public function cases() // Cases where user is a participant
    {
        return $this->belongsToMany(SuitCase::class, 'case_permissions')
            ->using(CasePermission::class)
            ->withPivot('permission_level')
            ->withTimestamps();
    }

    public function casePermissions()
    {
        return $this->hasMany(CasePermission::class);
    }

    public function eventNotifications()
    {
        return $this->hasMany(EventNotification::class);
    }

    /**
     * Scope a query to only include public profile attributes.
     */
    public function scopePublicProfile($query)
    {
        return $query->select('id', 'name', 'last_name', 'tag', 'role', 'profile_photo_path'); // profile_photo_url is appended via $appends
    }

    /**
     * Scope a query to search users by tag or name.
     */
    public function scopeSearchProfile($query, string $searchTerm)
    {
        return $query->where('tag', 'like', "%{$searchTerm}%")
            ->orWhere('name', 'like', "%{$searchTerm}%");
    }

    /**
     * Get user's event notifications with their associated event data.
     */
    public function getAndCleanEventNotifications(): \Illuminate\Support\Collection
    {
        $notifications = $this->eventNotifications()->with('event')->get();

        return $notifications->map(function ($notification) {
            $event = $notification->event;

            return (object) [
                'id' => $notification->id,
                'event_id' => $event->id,
                'user_id' => $this->id,
                'notify_at' => $notification->notify_at,
                'created_at' => $notification->created_at,
                'updated_at' => $notification->updated_at,
                'event_starts_at' => $event->starts_at,
                'event_is_all_day' => $event->is_all_day,
                'event_title' => $event->title,
            ];
        })->values();
    }

    /**
     * Determine if the user has an admin role.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
