<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EntregaResource extends JsonResource
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
            'honorario_id' => $this->honorario_id,
            'tipo_pago_id' => $this->tipo_pago_id,
            'monto' => $this->monto,
            'nota' => $this->nota,
            'tipo_pago' => new TipoPagoResource($this->whenLoaded('tipoPago')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
