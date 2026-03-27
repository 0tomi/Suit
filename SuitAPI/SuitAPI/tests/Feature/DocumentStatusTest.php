<?php

namespace Tests\Feature;

use App\Enums\DocumentStatus;
use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_creating_document_sets_default_status()
    {
        $user = User::factory()->create();
        $content = '<h1>Test</h1>';

        $response = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Document',
            'content' => $content,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('documents', [
            'name' => 'Test Document',
            'status' => DocumentStatus::Borrador->value,
        ]);
    }

    public function test_can_create_document_with_specific_status()
    {
        $user = User::factory()->create();
        $content = '<h1>Test</h1>';

        $response = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Document',
            'content' => $content,
            'status' => DocumentStatus::Firmado->value,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('documents', [
            'name' => 'Test Document',
            'status' => DocumentStatus::Firmado->value,
        ]);
    }

    public function test_can_update_document_status_via_update_endpoint_is_not_allowed()
    {
        $user = User::factory()->create();
        $document = Document::factory()->create(['user_id' => $user->id, 'status' => DocumentStatus::Borrador]);

        $response = $this->actingAs($user)->putJson("/api/documents/{$document->id}", [
            'status' => DocumentStatus::Presentado->value,
        ]);

        $response->assertStatus(422);
    }

    public function test_can_update_document_status_via_dedicated_endpoint()
    {
        $user = User::factory()->create();
        $document = Document::factory()->create(['user_id' => $user->id, 'status' => DocumentStatus::Borrador]);

        $response = $this->actingAs($user)->patchJson("/api/documents/{$document->id}/status", [
            'status' => DocumentStatus::Firmado->value,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'status' => DocumentStatus::Firmado->value,
        ]);
    }

    public function test_validates_document_status()
    {
        $user = User::factory()->create();
        $document = Document::factory()->create(['user_id' => $user->id, 'status' => DocumentStatus::Borrador]);

        $response = $this->actingAs($user)->patchJson("/api/documents/{$document->id}/status", [
            'status' => 'InvalidStatus',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }
}
