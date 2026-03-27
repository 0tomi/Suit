<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentVersionResource extends JsonResource
{
    /**
     * Exposes only client-relevant metadata. Internal fields (file_path,
     * encryption_iv, checksum) are intentionally excluded.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'document_id' => $this->document_id,
            'version_number' => $this->version_number,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'creator' => $this->whenLoaded('creator'),
            'created_at' => $this->created_at,
        ];
    }
}
