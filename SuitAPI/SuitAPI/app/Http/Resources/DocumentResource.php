<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
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
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'user_id' => $this->user_id,
            'suit_case_id' => $this->suit_case_id,
            'event_id' => $this->event_id,
            'status' => $this->status,
            'is_locked' => $this->is_locked,
            'locked_by' => $this->locked_by,
            'locked_at' => $this->locked_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
            'latest_version' => new DocumentVersionResource($this->whenLoaded('latestVersion')),
            'locker' => new UserResource($this->whenLoaded('locker')),
        ];
    }
}
