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
        $content = '<h1>Contract</h1>';
        $file = UploadedFile::fake()->createWithContent('contract.html', $content);

        $response = $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Contract',
            'content' => $content,
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

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Test Doc',
            'content' => $content,
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

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Original Doc',
            'content' => $content,
        ]);

        $document = Document::first();
        $version = $document->latestVersion;

        // Corrupt the file in storage
        // Since it's fake storage, we can overwrite it with garbage
        Storage::disk('local')->put($version->file_path, 'GARBAGE DATA');

        $response = $this->actingAs($user)->get('/api/documents/'.$document->id);

        $response->assertStatus(500);
    }

    public function test_locking_system_prevents_simultaneous_edits()
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();
        $case = SuitCase::factory()->create();

        $document = Document::create([
            'name' => 'Shared Doc',
            'user_id' => $user1->id, // Owner
            'suit_case_id' => $case->id,
        ]);

        $case->participants()->attach($user2->id, ['permission_level' => 'editor']);

        $this->actingAs($user1)->postJson("/api/documents/{$document->id}/lock")->assertStatus(200);

        $this->actingAs($user2)->postJson("/api/documents/{$document->id}/lock")->assertStatus(403);

        $content = '<h1>update</h1>';
        $file = UploadedFile::fake()->createWithContent('update.html', $content);
        $this->actingAs($user2)->putJson("/api/documents/{$document->id}", ['content' => $content])
            ->assertStatus(403);

        $this->actingAs($user1)->putJson("/api/documents/{$document->id}", ['content' => $content])
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

        $this->actingAs($outsider)->get("/api/documents/{$document->id}")->assertStatus(403);
    }

    public function test_creator_can_delete_document_without_case()
    {
        $user = User::factory()->create();
        $content = '<h1>to delete</h1>';
        $file = UploadedFile::fake()->createWithContent('to_delete.html', $content);

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Delete Me',
            'content' => $content,
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
        $content = '<h1>version1</h1>';
        $file = UploadedFile::fake()->createWithContent('version1.html', $content);

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Modified Test',
            'content' => $content,
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
        $content = '<h1>version1</h1>';
        $file = UploadedFile::fake()->createWithContent('version1.html', $content);

        $this->actingAs($user)->postJson('/api/documents', [
            'name' => 'Version Test',
            'content' => $content,
        ]);

        $document = Document::first();

        // Upload a second version
        $content2 = '<h1>version2</h1>';
        $file2 = UploadedFile::fake()->createWithContent('version2.html', $content2);
        $this->actingAs($user)->putJson("/api/documents/{$document->id}", [
            'content' => $content2,
        ]);

        $document->refresh();
        $this->assertCount(2, $document->versions);
    }

    public function test_document_versions_track_different_authors()
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
        $case->participants()->attach($editor->id, ['permission_level' => 'write']);

        // Owner creates the document (Version 1)
        $content1 = '<h1>v1</h1>';
        $file1 = UploadedFile::fake()->createWithContent('v1.html', $content1);
        $this->actingAs($owner)->postJson('/api/documents', [
            'name' => 'Multi-author Doc',
            'content' => $content1,
            'suit_case_id' => $case->id,
        ]);

        $document = Document::first();

        // Editor creates Version 2
        $content2 = '<h1>v2</h1>';
        $file2 = UploadedFile::fake()->createWithContent('v2.html', $content2);
        $this->actingAs($editor)->putJson("/api/documents/{$document->id}", [
            'content' => $content2,
        ]);

        $document->refresh();
        $this->assertCount(2, $document->versions);
        $this->assertEquals($owner->id, $document->versions->first()->created_by);
        $this->assertEquals($editor->id, $document->versions->last()->created_by);
    }
}
