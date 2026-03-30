<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ParteResource extends JsonResource
{
    /** @var string|null Disable the 'data' wrapper to match the rest of the API responses. */
    public static $wrap = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->persona?->first_name,
            'apellido' => $this->persona?->last_name,
            'email' => $this->persona?->email,
            'telefono' => $this->persona?->phone,
            'identificacion' => $this->persona?->identification_number,
            'direccion' => $this->persona?->address,
            'genero' => $this->persona?->gender,
            'estado' => $this->persona?->status,
            'notas' => $this->persona?->notes,
            'rol_id' => $this->rol_id,
            'rol' => new RolResource($this->whenLoaded('rol')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
