<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeadlineResource extends JsonResource
{
    /** @var string|null Disable the 'data' wrapper to match the rest of the API responses. */
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var \App\Models\Event|null $event */
        $event = $this->event instanceof \App\Models\Event ? $this->event : null;

        $notification = null;
        if ($event && $event->relationLoaded('notifications')) {
            $notification = $event->notifications->firstWhere('user_id', $request->user()?->id);
        }

        return [
            'id' => $this->id,
            'event_id' => $this->event_id,
            'suit_case_id' => $event?->suit_case_id,
            'title' => $this->title,
            'description' => $this->description,
            'due_date' => $this->due_date?->isMidnight()
                ? $this->due_date->format('Y-m-d')
                : $this->due_date?->format('Y-m-d H:i:s'),
            'priority' => $this->priority,
            'status' => $this->status,
            'notify_at' => $notification?->notify_at,
            'event' => $event ? new EventResource($event) : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
