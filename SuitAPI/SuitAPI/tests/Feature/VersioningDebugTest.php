<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VersioningDebugTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_store_creates_document_with_version_1(): void
    {
        $user = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

        $response = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'suit_case_id' => $case->id,
            'content' => '<h1>Hello World</h1>',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseCount('document_versions', 1);
        $this->assertDatabaseHas('document_versions', [
            'document_id' => $response->json('id'),
            'version_number' => 1,
            'mime_type' => 'text/html',
        ]);
    }

    public function test_update_with_content_creates_new_version(): void
    {
        $user = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

        // Create initial document
        $createResponse = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'suit_case_id' => $case->id,
            'content' => '<h1>Version 1</h1>',
        ]);

        $createResponse->assertStatus(201);
        $documentId = $createResponse->json('id');
        $this->assertDatabaseCount('document_versions', 1);

        // Update with new content via PUT
        $updateResponse = $this->actingAs($user)->putJson("/api/documents/{$documentId}", [
            'content' => '<h1>Version 2</h1>',
            'last_updated_at' => now()->addMinute()->toDateTimeString(),
        ]);

        $updateResponse->assertStatus(201); // returns the new version
        $this->assertDatabaseCount('document_versions', 2);
        $this->assertDatabaseHas('document_versions', [
            'document_id' => $documentId,
            'version_number' => 2,
        ]);
    }

    public function test_update_without_content_does_not_create_new_version(): void
    {
        $user = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

        $createResponse = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'suit_case_id' => $case->id,
            'content' => '<h1>Version 1</h1>',
        ]);

        $documentId = $createResponse->json('id');
        $this->assertDatabaseCount('document_versions', 1);

        // Status-only update (no content)
        $updateResponse = $this->actingAs($user)->patchJson("/api/documents/{$documentId}/status", [
            'status' => 'Firmado',
        ]);

        $updateResponse->assertStatus(200);
        $this->assertDatabaseCount('document_versions', 1); // No new version created
    }

    public function test_sync_up_creates_new_version_for_existing_document(): void
    {
        $user = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

        // Create initial document
        $createResponse = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'suit_case_id' => $case->id,
            'content' => '<p>Initial content</p>',
        ]);

        $createResponse->assertStatus(201);
        $documentId = $createResponse->json('id');
        $this->assertDatabaseCount('document_versions', 1);

        // Sync up an updated version
        $syncResponse = $this->actingAs($user)->postJson('/api/documents/sync', [
            'documents' => [
                [
                    'id' => $documentId,
                    'name' => 'Updated Doc',
                    'content' => '<p>Updated content</p>',
                    'last_updated_at' => now()->addMinute()->toDateTimeString(),
                ],
            ],
        ]);

        $syncResponse->assertStatus(200);
        $this->assertEmpty($syncResponse->json('conflicts'), 'There were conflicts in syncUp');
        $this->assertDatabaseCount('document_versions', 2);
        $this->assertDatabaseHas('document_versions', [
            'document_id' => $documentId,
            'version_number' => 2,
        ]);
    }

    public function test_sync_up_reports_conflict_when_document_was_modified(): void
    {
        $user = User::factory()->create();
        $userB = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

        $createResponse = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'suit_case_id' => $case->id,
            'content' => '<p>Initial</p>',
        ]);

        $documentId = $createResponse->json('id');
        $doc = Document::find($documentId);
        $doc->touch(); // Simulate server-side modification

        // Sync with an outdated last_updated_at (before the server's modification)
        $syncResponse = $this->actingAs($user)->postJson('/api/documents/sync', [
            'documents' => [
                [
                    'id' => $documentId,
                    'name' => 'Conflicting',
                    'content' => '<p>Conflicting content</p>',
                    'last_updated_at' => now()->subHour()->toDateTimeString(),
                ],
            ],
        ]);

        $syncResponse->assertStatus(200);
        $this->assertContains($documentId, $syncResponse->json('conflicts'));
        $this->assertDatabaseCount('document_versions', 1); // No new version was saved
    }
}
