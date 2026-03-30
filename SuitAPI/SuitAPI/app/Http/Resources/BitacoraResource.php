<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BitacoraResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $entity = $this->entity;

        // Dynamic summary fields based on entity type
        $entityInfo = $entity ? [
            'id' => $entity->id,
            'name' => $this->resolveEntitySummary($entity),
            'attributes' => $entity->toArray(), // Full attributes
        ] : null;

        return [
            'id' => $this->id,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'last_name' => $this->user->last_name,
            ],
            'action' => $this->action,
            'entity_info' => [
                'id' => $this->entity_id,
                'type' => $this->entity_type,
                'data' => $entityInfo,
            ],
            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }

    /**
     * Resolve a descriptive name for the entity based on its type and relationships.
     */
    protected function resolveEntitySummary(mixed $entity): ?string
    {
        switch ($this->entity_type) {
            case 'client':
                return trim(($entity->persona->last_name ?? '').' '.($entity->persona->first_name ?? ''));
            case 'user':
                return trim(($entity->last_name ?? '').' '.($entity->name ?? ''));
            case 'case':
                return $entity->title;
            case 'document':
                return $entity->name;
            case 'fee': // Honorario
                $caseTitle = $entity->suitCase?->title;

                return ($entity->detalles ?? 'Honorario').($caseTitle ? " (Caso: $caseTitle)" : '');
            case 'tax': // Gasto
                // Gastos are BelongsToMany with SuitCases, picking the first one if available as reference
                $caseTitle = $entity->suitCases->first()?->title;

                return ($entity->titulo ?? 'Gasto').($caseTitle ? " (Caso: $caseTitle)" : '');
            case 'delivery': // Entrega
                $honorarioDesc = $entity->honorario?->detalles;

                return 'Entrega de $'.$entity->monto.($honorarioDesc ? " (Honorario: $honorarioDesc)" : '');
            case 'event':
                return $entity->title;
            case 'agenda':
                return $entity->name ?? ($entity->suitCase ? 'Agenda de: '.$entity->suitCase->title : 'Agenda Personal');
            case 'multimedia':
            case 'file':
                return $entity->filename;
            case 'role':
            case 'jurisdiction':
                return $entity->nombre;
            case 'competency':
                return $entity->fuero;
            case 'judicial_dependency':
                $juris = $entity->jurisdiccion?->nombre;
                $comp = $entity->competencia?->fuero;

                return ($entity->nombre_juzgado ?? 'Juzgado').($juris || $comp ? " ($juris / $comp)" : '');
            case 'radicacion':
                return $entity->tipo;
            default:
                return $entity->name ?? $entity->nombre ?? $entity->title ?? $entity->filename ?? $entity->description ?? $entity->titulo ?? $entity->fuero ?? $entity->tipo ?? null;
        }
    }
}
