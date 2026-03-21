<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ParteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'apellido' => $this->apellido,
            'email' => $this->email,
            'telefono' => $this->telefono,
            'rol_id' => $this->rol_id,
            'rol' => new RolResource($this->whenLoaded('rol')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
