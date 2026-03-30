<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HonorarioResource extends JsonResource
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
        $totalEntregas = $this->entregas ? $this->entregas->sum('monto') : 0;

        return [
            'id' => $this->id,
            'suit_case_id' => $this->suit_case_id,
            'client_id' => $this->client_id,
            'user_id' => $this->user_id,
            'monto' => $this->monto,
            'detalles' => $this->detalles,
            'pagado' => $this->pagado,
            'total_entregas' => $totalEntregas,
            'client' => new ClientResource($this->whenLoaded('client')),
            'entregas' => EntregaResource::collection($this->whenLoaded('entregas')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
