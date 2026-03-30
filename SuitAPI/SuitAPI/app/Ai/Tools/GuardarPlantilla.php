<?php

namespace App\Ai\Tools;

use App\Models\PlantillaRequisito;
use App\Models\Template;
use App\Models\TemplateCategory;
use App\Services\ConversationTemplateStateService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;
use Throwable;

class GuardarPlantilla implements Tool
{
    public function __construct(private ?string $conversationId = null) {}

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Guarda la plantilla finalizada en la base de datos usando el HTML reconstruido en el servidor junto con sus requisitos. Llamá a esta herramienta SÓLO cuando el usuario confirme explícitamente que la plantilla está lista para guardarse.';
    }

    /**
     * Execute the tool.
     */
    public function handle(Request $request): Stringable|string
    {
        try {
            if ($this->conversationId === null) {
                return 'No se pudo guardar la plantilla porque la conversación actual no está disponible.';
            }

            return DB::transaction(function () use ($request): string {
                $currentHtml = resolve(ConversationTemplateStateService::class)
                    ->syncPendingPatches($this->conversationId);

                if ($currentHtml === null) {
                    return 'No se pudo guardar la plantilla porque la conversación no tiene un HTML inicial.';
                }

                $categoryName = trim((string) ($request['category_name'] ?? ''));
                $category = $categoryName === ''
                    ? TemplateCategory::defaultCategory()
                    : TemplateCategory::query()->firstOrCreate(['name' => $categoryName]);

                $template = Template::query()->create([
                    'template_category_id' => $category->id,
                    'title' => $request['title'],
                    'content' => $currentHtml,
                ]);

                $requisitos = $request['requisitos'] ?? [];

                foreach ($requisitos as $req) {
                    PlantillaRequisito::query()->create([
                        'template_id' => $template->id,
                        'requisito_id' => $req['requisito_id'],
                        'id_campo' => $req['id_campo'],
                        'NEntidad' => $req['NEntidad'] ?? 1,
                        'note' => $req['note'] ?? null,
                    ]);
                }

                return "La plantilla '{$template->title}' ha sido guardada exitosamente con el ID {$template->id}.";
            });
        } catch (Throwable $exception) {
            return 'Hubo un error al intentar guardar la plantilla: '.$exception->getMessage();
        }
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'title' => $schema->string()->description('El título de la plantilla. Debes inferirlo del contexto si el usuario no especificó uno.')->required(),
            'category_name' => $schema->string()->description('Nombre de la categoría en la que agrupar esta plantilla. Infiérelo o usa "General" si no estás seguro.'),
            'requisitos' => $schema->array()->items(
                $schema->object([
                    'requisito_id' => $schema->integer()->description('El ID del Requisito en la base de datos.')->required(),
                    'id_campo' => $schema->integer()->description('El número n utilizado en el marcador #n# correspondiente a este campo.')->required(),
                    'NEntidad' => $schema->integer()->description('Número de entidad asociada al requisito. Si no se provee, se usa 1.'),
                    'note' => $schema->string()->description('Breve descripción opcional sobre qué se espera que el usuario llene en este campo.'),
                ])
            )->description('Lista de requisitos/variables utilizados en la plantilla.')->required(),
        ];
    }
}
