<?php

use App\Jobs\ArchiveOldDocumentVersions;
use App\Models\Document;
use App\Models\DocumentArchiveSession;
use App\Models\DocumentVersion;
use App\Models\SuitCase;
use App\Models\User;
use App\Services\DocumentArchiveService;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
    Queue::fake();
});

// ---------------------------------------------------------------------------
// Job dispatching
// ---------------------------------------------------------------------------

it('dispatches ArchiveOldDocumentVersions job when a second version is created', function () {
    $user = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $this->actingAs($user)->postJson('/api/documents', [
        'name' => 'Doc',
        'suit_case_id' => $case->id,
        'content' => '<p>v1</p>',
    ])->assertStatus(201);

    // First version: no previous to archive → no job dispatched.
    Queue::assertNothingPushed();

    $documentId = Document::first()->id;

    $this->actingAs($user)->putJson("/api/documents/{$documentId}", [
        'content' => '<p>v2</p>',
    ])->assertStatus(201);

    // Second version: previous exists → job dispatched to 'documents' queue.
    Queue::assertPushedOn('documents', ArchiveOldDocumentVersions::class);
});

it('does not dispatch archive job on first version', function () {
    $user = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $this->actingAs($user)->postJson('/api/documents', [
        'name' => 'Doc',
        'suit_case_id' => $case->id,
        'content' => '<p>v1</p>',
    ])->assertStatus(201);

    Queue::assertNothingPushed();
});

// ---------------------------------------------------------------------------
// /versions endpoint returns metadata without internal fields
// ---------------------------------------------------------------------------

it('versions endpoint returns metadata without file_path or encryption_iv', function () {
    $user = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $this->actingAs($user)->postJson('/api/documents', [
        'name' => 'Doc',
        'suit_case_id' => $case->id,
        'content' => '<p>v1</p>',
    ])->assertStatus(201);

    $documentId = Document::first()->id;

    $response = $this->actingAs($user)
        ->getJson("/api/documents/{$documentId}/versions")
        ->assertStatus(200);

    $version = $response->json('data.0');

    expect($version)->toHaveKeys(['id', 'version_number', 'mime_type', 'size', 'created_at'])
        ->and($version)->not->toHaveKey('file_path')
        ->and($version)->not->toHaveKey('encryption_iv')
        ->and($version)->not->toHaveKey('checksum');
});

// ---------------------------------------------------------------------------
// showVersion endpoint (GET /documents/{id}/versions/{number})
// ---------------------------------------------------------------------------

it('showVersion returns the correct HTML content for the latest version', function () {
    $user = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $this->actingAs($user)->postJson('/api/documents', [
        'name' => 'Doc',
        'suit_case_id' => $case->id,
        'content' => '<h1>Version 1</h1>',
    ])->assertStatus(201);

    $documentId = Document::first()->id;

    $response = $this->actingAs($user)
        ->get("/api/documents/{$documentId}/versions/1");

    $response->assertStatus(200);
    expect($response->getContent())->toBe('<h1>Version 1</h1>');
});

it('showVersion returns 404 for a non-existent version number', function () {
    $user = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $this->actingAs($user)->postJson('/api/documents', [
        'name' => 'Doc',
        'suit_case_id' => $case->id,
        'content' => '<h1>Only v1</h1>',
    ])->assertStatus(201);

    $documentId = Document::first()->id;

    $this->actingAs($user)
        ->getJson("/api/documents/{$documentId}/versions/99")
        ->assertStatus(404);
});

// ---------------------------------------------------------------------------
// DocumentArchiveService unit-level tests (using real service, fake storage)
// ---------------------------------------------------------------------------

it('DocumentArchiveService correctly archives a previous version and cleans up', function () {
    $user = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    /** @var DocumentArchiveService $archiveService */
    $archiveService = app(DocumentArchiveService::class);

    // Create a document with two DocumentVersion records manually so we can
    // call archivePreviousVersion() directly without relying on the Job.
    $document = Document::factory()->create([
        'user_id' => $user->id,
        'suit_case_id' => $case->id,
    ]);

    $v1Html = '<p>Version 1 content</p>';
    $v2Html = '<p>Version 2 content</p>';

    // Simulate what DocumentService does when saving v1 and v2.
    $encService = app(\App\Services\FileEncryptionService::class);

    $enc1 = $encService->encrypt($v1Html);
    $v1Path = 'secure_docs/'.str()->uuid();
    Storage::disk('local')->put($v1Path, $enc1['content']);

    $v1 = DocumentVersion::create([
        'document_id' => $document->id,
        'version_number' => 1,
        'file_path' => $v1Path,
        'mime_type' => 'text/html',
        'size' => strlen($v1Html),
        'encryption_iv' => $enc1['iv'],
        'checksum' => hash('sha256', $v1Html),
        'created_by' => $user->id,
    ]);

    $enc2 = $encService->encrypt($v2Html);
    $v2Path = 'secure_docs/'.str()->uuid();
    Storage::disk('local')->put($v2Path, $enc2['content']);

    $v2 = DocumentVersion::create([
        'document_id' => $document->id,
        'version_number' => 2,
        'file_path' => $v2Path,
        'mime_type' => 'text/html',
        'size' => strlen($v2Html),
        'encryption_iv' => $enc2['iv'],
        'checksum' => hash('sha256', $v2Html),
        'created_by' => $user->id,
    ]);

    // Run the archival: v1 (old) should be packed into {v2Path}.arch and its individual file removed.
    $archiveService->archivePreviousVersion($v1, $v2);

    // v1 individual file should be gone.
    expect(Storage::disk('local')->exists($v1Path))->toBeFalse();

    // A .arch file should exist at {v2Path}.arch.
    $archivePath = $v2Path.'.arch';
    expect(Storage::disk('local')->exists($archivePath))->toBeTrue();
    expect(Storage::disk('local')->exists($archivePath.'.iv'))->toBeTrue();

    // v2 individual file must still exist (it's the latest).
    expect(Storage::disk('local')->exists($v2Path))->toBeTrue();
});

it('cleanupExpiredSessions removes extracted files and session records', function () {
    $user = User::factory()->create();
    $document = Document::factory()->create(['user_id' => $user->id]);

    // Simulate an expired session with a fake extracted file.
    $extractedPath = 'secure_docs/sessions/'.$document->id;
    Storage::disk('local')->put($extractedPath.'/fake_file', 'content');

    DocumentArchiveSession::create([
        'document_id' => $document->id,
        'extracted_path' => $extractedPath,
        'archive_path' => 'secure_docs/fake.arch',
        'keep_until' => now()->subMinute(), // already expired
    ]);

    expect(DocumentArchiveSession::count())->toBe(1);

    /** @var DocumentArchiveService $archiveService */
    $archiveService = app(DocumentArchiveService::class);
    $cleaned = $archiveService->cleanupExpiredSessions();

    expect($cleaned)->toBe(1)
        ->and(DocumentArchiveSession::count())->toBe(0)
        ->and(Storage::disk('local')->exists($extractedPath.'/fake_file'))->toBeFalse();
});
