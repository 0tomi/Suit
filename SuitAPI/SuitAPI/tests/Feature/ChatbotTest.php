<?php

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'lawyer']);
    Setting::setAiApiKey('openai', 'sk-fake');
    Setting::setAiActiveConfig('openai', 'gpt-4o');
});

test('user can start a conversation and receive streamed response', function () {
    \App\Ai\Agents\PlantillaAgent::fake();

    $response = $this->actingAs($this->user)->postJson('/api/chatbot/conversations', [
        'prompt' => 'Hola, necesito crear una demanda.',
        'html_content' => '<p>Documento inicial</p>',
    ]);

    $response->assertSuccessful()
        ->assertHeader('X-Conversation-Id');

    $conversationId = $response->headers->get('X-Conversation-Id');
    $this->assertDatabaseHas('agent_conversations', [
        'id' => $conversationId,
        'user_id' => $this->user->id,
        'current_html' => '<p>Documento inicial</p>',
    ]);
});

test('user can see their conversations', function () {
    DB::table('agent_conversations')->insert([
        'id' => (string) str()->uuid(),
        'user_id' => $this->user->id,
        'title' => 'Test Conversation',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->actingAs($this->user)->getJson('/api/chatbot/conversations');

    $response->assertSuccessful()
        ->assertJsonPath('data.0.title', 'Test Conversation');
});

test('user can reply to an existing conversation and sync pending patches first', function () {
    \App\Ai\Agents\PlantillaAgent::fake();

    $convId = (string) str()->uuid();
    $assistantMessageId = (string) str()->uuid();

    DB::table('agent_conversations')->insert([
        'id' => $convId,
        'user_id' => $this->user->id,
        'title' => 'Existing',
        'current_html' => '<p>Juan Perez</p>',
        'last_processed_assistant_message_id' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('agent_conversation_messages')->insert([
        'id' => $assistantMessageId,
        'conversation_id' => $convId,
        'user_id' => $this->user->id,
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

    $response = $this->actingAs($this->user)->postJson("/api/chatbot/conversations/{$convId}/reply", [
        'prompt' => 'Sigue analizando el documento.',
    ]);

    $response->assertSuccessful()
        ->assertHeader('X-Conversation-Id', $convId);

    $this->assertDatabaseHas('agent_conversations', [
        'id' => $convId,
        'current_html' => '<p>#1#</p>',
        'last_processed_assistant_message_id' => $assistantMessageId,
    ]);
});

test('user can delete their conversation', function () {
    $convId = (string) str()->uuid();
    DB::table('agent_conversations')->insert([
        'id' => $convId,
        'user_id' => $this->user->id,
        'title' => 'To be deleted',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->actingAs($this->user)->deleteJson("/api/chatbot/conversations/{$convId}");

    $response->assertSuccessful();
    $this->assertDatabaseMissing('agent_conversations', ['id' => $convId]);
});

test('example', function () {
    $response = $this->get('/');

    $response->assertStatus(200);
});
