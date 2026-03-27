<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class PublicFileResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'url' => Storage::disk('public_files')->url($this->path),
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'hash' => $this->hash,
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
            'deleted_at' => $this->when($this->trashed(), $this->deleted_at?->toIso8601String()),
            'updated_by' => $this->updated_by,
            'user' => new UserResource($this->whenLoaded('user')),
            'updater' => new UserResource($this->whenLoaded('updatedBy')),
        ];
    }
}
