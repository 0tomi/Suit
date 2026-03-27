<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SuitCaseResource extends JsonResource
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
            'title' => $this->title,
            'status' => $this->status,
            'case_type_id' => $this->case_type_id,
            'start_date' => $this->start_date ? $this->start_date->format('Y-m-d') : null,
            'end_date' => $this->end_date ? $this->end_date->format('Y-m-d') : null,
            'details' => $this->details,
            'nro_expediente' => $this->nro_expediente,
            'radicacion_id' => $this->radicacion_id,
            'dependencia_id' => $this->dependencia_id,
            'owner_tag' => $this->owner_tag,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
            'type' => new CaseTypeResource($this->whenLoaded('type')),
            'radicacion' => new RadicacionResource($this->whenLoaded('radicacion')),
            'dependencia_judicial' => new DependenciaJudicialResource($this->whenLoaded('dependenciaJudicial')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'participants' => UserResource::collection($this->whenLoaded('participants')),
            'tipo_expedientes' => TipoExpedienteResource::collection($this->whenLoaded('tipoExpedientes')),
        ];
    }
}
