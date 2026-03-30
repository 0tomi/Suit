<?php

use App\Ai\Tools\GuardarPlantilla;
use App\Models\Requisito;
use App\Services\ConversationTemplateStateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Tools\Request;

uses(RefreshDatabase::class);

test('it applies pending template patches only once', function () {
    $conversationId = (string) str()->uuid();
    $assistantMessageId = (string) str()->uuid();

    DB::table('agent_conversations')->insert([
        'id' => $conversationId,
        'user_id' => null,
        'title' => 'Plantilla',
        'current_html' => '<p>Juan Perez firmó con Juan Perez.</p>',
        'last_processed_assistant_message_id' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('agent_conversation_messages')->insert([
        'id' => $assistantMessageId,
        'conversation_id' => $conversationId,
        'user_id' => null,
        'agent' => \App\Ai\Agents\PlantillaAgent::class,
        'role' => 'assistant',
        'content' => '<template_patches>[{"buscar":"Juan Perez","reemplazar_con":"#1#"}]</template_patches>',
        'attachments' => '[]',
        'tool_calls' => '[]',
        'tool_results' => '[]',
        'usage' => '[]',
        'meta' => '[]',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $service = app(ConversationTemplateStateService::class);

    expect($service->syncPendingPatches($conversationId))
        ->toBe('<p>#1# firmó con #1#.</p>');

    $this->assertDatabaseHas('agent_conversations', [
        'id' => $conversationId,
        'current_html' => '<p>#1# firmó con #1#.</p>',
        'last_processed_assistant_message_id' => $assistantMessageId,
    ]);

    expect($service->syncPendingPatches($conversationId))
        ->toBe('<p>#1# firmó con #1#.</p>');

    $this->assertDatabaseCount('agent_conversation_messages', 1);
});

test('guardar plantilla persists the reconstructed html from the conversation state', function () {
    $conversationId = (string) str()->uuid();
    $assistantMessageId = (string) str()->uuid();
    $requisito = Requisito::factory()->create();

    DB::table('agent_conversations')->insert([
        'id' => $conversationId,
        'user_id' => null,
        'title' => 'Plantilla',
        'current_html' => '<p>Juan Perez firmó el contrato.</p>',
        'last_processed_assistant_message_id' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('agent_conversation_messages')->insert([
        'id' => $assistantMessageId,
        'conversation_id' => $conversationId,
        'user_id' => null,
        'agent' => \App\Ai\Agents\PlantillaAgent::class,
        'role' => 'assistant',
        'content' => '<template_patches>[{"buscar":"Juan Perez","reemplazar_con":"#1#"}]</template_patches>',
        'attachments' => '[]',
        'tool_calls' => '[]',
        'tool_results' => '[]',
        'usage' => '[]',
        'meta' => '[]',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $tool = new GuardarPlantilla($conversationId);
    $result = $tool->handle(new Request([
        'title' => 'Contrato de Prueba',
        'category_name' => 'Contratos',
        'requisitos' => [
            [
                'requisito_id' => $requisito->id,
                'id_campo' => 1,
                'note' => 'Nombre del firmante',
            ],
        ],
    ]));

    expect((string) $result)->toContain('ha sido guardada exitosamente');

    $this->assertDatabaseHas('templates', [
        'title' => 'Contrato de Prueba',
        'content' => '<p>#1# firmó el contrato.</p>',
    ]);

    $templateId = DB::table('templates')
        ->where('title', 'Contrato de Prueba')
        ->value('id');

    $categoryId = DB::table('template_categories')
        ->where('name', 'Contratos')
        ->value('id');

    expect($templateId)->not->toBeNull();
    expect($categoryId)->not->toBeNull();

    $this->assertDatabaseHas('templates', [
        'id' => $templateId,
        'template_category_id' => $categoryId,
    ]);

    $this->assertDatabaseHas('plantilla_requisitos', [
        'template_id' => $templateId,
        'requisito_id' => $requisito->id,
        'id_campo' => 1,
        'NEntidad' => 1,
        'note' => 'Nombre del firmante',
    ]);
});
