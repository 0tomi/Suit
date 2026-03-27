<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $fillable = ['agenda_id', 'suit_case_id', 'event_type_id', 'title', 'description', 'starts_at', 'is_all_day'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'is_all_day' => 'boolean',
        ];
    }

    public function agenda(): BelongsTo
    {
        return $this->belongsTo(Agenda::class);
    }

    public function suitCase(): BelongsTo
    {
        return $this->belongsTo(SuitCase::class);
    }

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(EventType::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(EventNotification::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function deadline(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Deadline::class);
    }
}
