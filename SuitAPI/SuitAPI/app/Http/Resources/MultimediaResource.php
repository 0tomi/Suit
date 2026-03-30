<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MultimediaResource extends JsonResource
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
            'filename' => $this->filename,
            'path' => $this->path,
            'hash' => $this->hash,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'suit_case_id' => $this->suit_case_id,
            'user_id' => $this->user_id,
            'updated_by' => $this->updated_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
        ];
    }
}
