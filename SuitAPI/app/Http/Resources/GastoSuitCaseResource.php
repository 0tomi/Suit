<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GastoSuitCaseResource extends JsonResource
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
            'suit_case_id' => $this->suit_case_id,
            'gasto_id' => $this->gasto_id,
            'user_id' => $this->user_id,
            'monto' => $this->monto,
            'gasto' => new GastoResource($this->whenLoaded('type')),
            'clients' => ClientResource::collection($this->whenLoaded('clients')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
