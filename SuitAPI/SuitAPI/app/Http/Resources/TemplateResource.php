<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TemplateResource extends JsonResource
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
            'template_category_id' => $this->template_category_id,
            'title' => $this->title,
            'content' => $this->whenHas('content'),
            'created_at' => $this->whenHas('created_at'),
            'updated_at' => $this->whenHas('updated_at'),
            'category' => $this->whenLoaded('category'),
            'requirements' => $this->whenLoaded('requirements', function () {
                return $this->requirements->map(function ($req) {
                    return [
                        'id' => $req->id,
                        'id_campo' => $req->pivot->id_campo,
                        'NEntidad' => $req->pivot->NEntidad,
                        'note' => $req->pivot->note,
                        'requisito_id' => $req->id, // Requisito ID as requested
                        'type' => $req->type,
                        'title' => $req->title,
                    ];
                });
            }),
        ];
    }
}
