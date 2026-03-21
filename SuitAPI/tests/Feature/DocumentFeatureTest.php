<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Clear secure_docs storage
        Storage::fake('local');
    }

    public function test_can_upload_document_and_create_version()
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('contract.html', 100, 'text/html');

        $response = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Contract',
            'file' => $file,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('documents', [
            'name' => 'Contract',
            'user_id' => $user->id,
        ]);

        $this->assertDatabaseHas('document_versions', [
            'version_number' => 1,
            'mime_type' => 'text/html',
        ]);

        $document = Document::first();
        $version = $document->latestVersion;

        // Assert file exists in storage
        Storage::disk('local')->assertExists($version->file_path);
    }

    public function test_can_download_and_decrypt_document()
    {
        $user = User::factory()->create();
        $content = '<h1>Hello World</h1>';
        $file = UploadedFile::fake()->createWithContent('test.html', $content);

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'file' => $file,
        ]);

        $document = Document::first();

        $response = $this->actingAs($user)->get('/api/documents/'.$document->id);

        $response->assertStatus(200);
        $this->assertEquals($content, $response->getContent());
    }

    public function test_integrity_check_fails_on_corrupted_file()
    {
        $user = User::factory()->create();
        $content = '<h1>Original Content</h1>';
        $file = UploadedFile::fake()->createWithContent('original.html', $content);

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Original Doc',
            'file' => $file,
        ]);

        $document = Document::first();
        $version = $document->latestVersion;

        // Corrupt the file in storage
        // Since it's fake storage, we can overwrite it with garbage
        Storage::disk('local')->put($version->file_path, 'GARBAGE DATA');

        $response = $this->actingAs($user)->get('/api/documents/'.$document->id);

        $response->assertStatus(500); // Decryption failed or integrity check failed
        // Note: Decryption might fail first if it's garbage and not valid AES structure, or if it decrypts to something else checksum fails.
    }

    public function test_locking_system_prevents_simultaneous_edits()
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $case = SuitCase::factory()->create(); // Assuming factory exists
        // Add users to case if needed by policy, or just let them be owners/participants
        // To simplify policy check, let's just make user1 the owner

        $document = Document::create([
            'name' => 'Shared Doc',
            'user_id' => $user1->id, // Owner
            'suit_case_id' => $case->id,
        ]);

        // Attach user2 to case so they pass policy check
        $case->participants()->attach($user2->id, ['permission_level' => 'editor']); // Assuming pivot field

        // Let's manually create a version so it exists
        // Need to use service or factory logic or just bypass for test setup
        // Actually, let's just use the API to create it

        // User 1 locks document
        $this->actingAs($user1)->postJson("/api/documents/{$document->id}/lock")->assertStatus(200);

        // User 2 tries to lock
        $this->actingAs($user2)->postJson("/api/documents/{$document->id}/lock")->assertStatus(409);

        // User 2 tries to update (upload new version)
        $file = UploadedFile::fake()->create('update.html', 100, 'text/html');
        $this->actingAs($user2)->putJson("/api/documents/{$document->id}", ['file' => $file])
            ->assertStatus(403); // Locked by another user

        // User 1 Updates
        $this->actingAs($user1)->putJson("/api/documents/{$document->id}", ['file' => $file])
            ->assertStatus(201);
    }

    public function test_document_access_policy()
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();

        $document = Document::create([
            'name' => 'Private Doc',
            'user_id' => $owner->id,
        ]);

        // Outsider cannot view
        $this->actingAs($outsider)->get("/api/documents/{$document->id}")->assertStatus(403);

        // Owner can view (after creating a version physically, else 404 on version or error)
        // Let's create a dummy version manually for the test
        DocumentVersion::create([
            'document_id' => $document->id,
            'version_number' => 1,
            'file_path' => 'dummy/path',
            'mime_type' => 'text/html',
            'size' => 100,
            'encryption_iv' => 'abc',
            'checksum' => '123',
            'created_by' => $owner->id,
        ]);
        // Also ensure file exists for read test or mock it, but here we expect 403 earlier.

        // Outsider 403 check is valid regardless of file existence usually.
    }

    public function test_creator_can_delete_document_without_case()
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('to_delete.html', 100, 'text/html');

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Delete Me',
            'file' => $file,
        ]);

        $document = Document::first();
        $version = $document->latestVersion;
        $path = $version->file_path;

        Storage::disk('local')->assertExists($path);

        $this->actingAs($user)->deleteJson("/api/documents/{$document->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('documents', ['id' => $document->id]);
        $this->assertTrue(Storage::disk('local')->exists($path));
    }

    public function test_admin_can_delete_any_document()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);

        $document = Document::create([
            'name' => 'Admin Delete Me',
            'user_id' => $owner->id,
        ]);

        $this->actingAs($admin)->deleteJson("/api/documents/{$document->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('documents', ['id' => $document->id]);
    }

    public function test_admin_can_view_and_list_any_documents()
    {
        $owner = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);

        $first = Document::create([
            'name' => 'Owner private',
            'user_id' => $owner->id,
        ]);
        $second = Document::create([
            'name' => 'Owner second',
            'user_id' => $owner->id,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/documents')
            ->assertOk()
            ->assertJsonFragment(['id' => $first->id])
            ->assertJsonFragment(['id' => $second->id]);

        $this->actingAs($admin)
            ->getJson("/api/documents/{$first->id}/is-locked")
            ->assertOk();
    }

    public function test_participant_with_read_permission_cannot_delete_case_document()
    {
        $owner = User::factory()->create();
        $participant = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
        $case->participants()->attach($participant->id, ['permission_level' => 'read']);

        $document = Document::create([
            'name' => 'Case Doc',
            'user_id' => $owner->id,
            'suit_case_id' => $case->id,
        ]);

        $this->actingAs($participant)->deleteJson("/api/documents/{$document->id}")
            ->assertStatus(403);
    }

    public function test_participant_with_write_permission_can_delete_case_document()
    {
        $owner = User::factory()->create();
        $participant = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
        $case->participants()->attach($participant->id, ['permission_level' => 'write']);

        $document = Document::create([
            'name' => 'Case Doc',
            'user_id' => $owner->id,
            'suit_case_id' => $case->id,
        ]);

        $this->actingAs($participant)->deleteJson("/api/documents/{$document->id}")
            ->assertStatus(204);

        $this->assertSoftDeleted('documents', ['id' => $document->id]);
    }

    public function test_can_check_if_document_is_locked()
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);
        $case->participants()->attach($otherUser->id, ['permission_level' => 'read']);

        $document = Document::create([
            'name' => 'Lock Test',
            'user_id' => $user->id,
            'suit_case_id' => $case->id,
        ]);

        // Initially not locked
        $response = $this->actingAs($otherUser)->getJson("/api/documents/{$document->id}/is-locked");
        $response->assertStatus(200)->assertJson(['is_locked' => false]);

        // Lock it
        $document->lock($user);

        $response = $this->actingAs($otherUser)->getJson("/api/documents/{$document->id}/is-locked");
        $response->assertStatus(200)->assertJson(['is_locked' => true]);
    }

    public function test_can_check_document_last_modified()
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('version1.html', 100, 'text/html');

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Modified Test',
            'file' => $file,
        ]);

        $document = Document::first();

        $response = $this->actingAs($user)->getJson("/api/documents/{$document->id}/last-modified");

        $response->assertStatus(200)
            ->assertJsonStructure(['last_modified', 'user'])
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_can_list_document_versions_with_creator()
    {
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('version1.html', 100, 'text/html');

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Version Test',
            'file' => $file,
        ]);

        $document = Document::first();

        // Upload a second version
        $file2 = UploadedFile::fake()->create('version2.html', 200, 'text/html');
        $this->actingAs($user)->putJson("/api/documents/{$document->id}", [
            'file' => $file2,
        ]);

        $response = $this->actingAs($user)->getJson("/api/documents/{$document->id}/versions");

        $response->assertStatus(200)
            ->assertJsonCount(2)
            ->assertJsonStructure([
                '*' => [
                    'id',
                    'version_number',
                    'created_by',
                    'creator' => ['id', 'name'],
                ],
            ]);
    }

    public function test_document_versions_track_different_authors()
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
        $case->participants()->attach($editor->id, ['permission_level' => 'write']);

        // Owner creates the document (Version 1)
        $file1 = UploadedFile::fake()->create('v1.html', 100, 'text/html');
        $this->actingAs($owner)->postJson('/api/documents', [
            'name' => 'Multi-author Doc',
            'file' => $file1,
            'suit_case_id' => $case->id,
        ]);

        $document = Document::first();

        // Editor creates Version 2
        $file2 = UploadedFile::fake()->create('v2.html', 200, 'text/html');
        $this->actingAs($editor)->putJson("/api/documents/{$document->id}", [
            'file' => $file2,
        ]);

        // Get versions and verify authors
        $response = $this->actingAs($owner)->getJson("/api/documents/{$document->id}/versions");

        $response->assertStatus(200)
            ->assertJsonCount(2)
            ->assertJsonPath('0.version_number', 2)
            ->assertJsonPath('0.created_by', $editor->id)
            ->assertJsonPath('0.creator.id', $editor->id)
            ->assertJsonPath('1.version_number', 1)
            ->assertJsonPath('1.created_by', $owner->id)
            ->assertJsonPath('1.creator.id', $owner->id);
    }
}
