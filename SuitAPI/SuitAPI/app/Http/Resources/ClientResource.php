<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
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
            'first_name' => $this->persona?->first_name,
            'last_name' => $this->persona?->last_name,
            'identification_number' => $this->persona?->identification_number,
            'email' => $this->persona?->email,
            'phone' => $this->persona?->phone,
            'address' => $this->persona?->address,
            'type' => $this->type,
            'status' => $this->persona?->status,
            'financial_status' => $this->financial_status,
            'notes' => $this->persona?->notes,
            'gender' => $this->persona?->gender,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
            'cases' => $this->whenLoaded('cases'),
            'documents' => $this->whenLoaded('documents'),
        ];
    }
}
