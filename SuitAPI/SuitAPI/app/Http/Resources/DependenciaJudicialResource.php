<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DependenciaJudicialResource extends JsonResource
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
            'jurisdiccion_id' => $this->jurisdiccion_id,
            'competencia_id' => $this->competencia_id,
            'radicacion_id' => $this->radicacion_id,
            'nombre_juzgado' => $this->nombre_juzgado,
            'jurisdiccion' => new JurisdiccionResource($this->whenLoaded('jurisdiccion')),
            'competencia' => new CompetenciaResource($this->whenLoaded('competencia')),
            'radicacion' => new RadicacionResource($this->whenLoaded('radicacion')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
