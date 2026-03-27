<?php

use App\Models\Multimedia;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\artisan;
use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
    $this->user = User::factory()->create();
    actingAs($this->user);
});

test('can upload multimedia and it is stored encrypted', function () {
    $file = UploadedFile::fake()->image('evidencia.jpg');

    $response = postJson('/api/multimedia', [
        'file' => $file,
    ])->assertCreated();

    $multimedia = Multimedia::first();
    expect($multimedia->filename)->toBe('evidencia.jpg');

    // Verify file exists on disk
    Storage::disk('local')->assertExists($multimedia->path);

    // Verify physical content is NOT the original content (it should be encrypted)
    $originalContent = file_get_contents($file->getRealPath());
    $storedContent = Storage::disk('local')->get($multimedia->path);
    expect($storedContent)->not->toBe($originalContent);
});

test('can download and decrypt multimedia content', function () {
    $content = 'Fake binary content'; // In a real image it would be binary
    $file = UploadedFile::fake()->createWithContent('image.jpg', $content);

    postJson('/api/multimedia', [
        'file' => $file,
    ])->assertCreated();

    $multimedia = Multimedia::first();

    $response = getJson("/api/multimedia/{$multimedia->id}")
        ->assertOk()
        ->assertHeader('Content-Type', 'image/jpeg');

    expect($response->getContent())->toBe($content);
});

test('soft delete preserves physical file but cleanup command removes it after deadline', function () {
    $file = UploadedFile::fake()->image('delete_test.jpg');
    postJson('/api/multimedia', ['file' => $file])->assertCreated();

    $multimedia = Multimedia::first();
    $path = $multimedia->path;

    // 1. Soft Delete
    deleteJson("/api/multimedia/{$multimedia->id}")->assertNoContent();

    $this->assertSoftDeleted('multimedia', ['id' => $multimedia->id]);
    Storage::disk('local')->assertExists($path); // Still there!

    // 2. Run cleanup (default 30 days, so it should stay)
    artisan('app:cleanup-deleted-files')->assertSuccessful();
    Storage::disk('local')->assertExists($path); // Still there!

    // 3. Mock time to be 31 days in the future
    $this->travel(31)->days();

    artisan('app:cleanup-deleted-files')->assertSuccessful();
    Storage::disk('local')->assertMissing($path); // Gone!
    $this->assertDatabaseMissing('multimedia', ['id' => $multimedia->id]); // Purged!
});

test('authorization: participants can view multimedia, outsiders cannot', function () {
    $owner = User::factory()->create();
    $participant = User::factory()->create();
    $outsider = User::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
    $case->participants()->attach($participant->id, ['permission_level' => 'read']);

    // Owner uploads
    actingAs($owner);
    $file = UploadedFile::fake()->image('case_evidence.jpg');
    $response = postJson('/api/multimedia', [
        'file' => $file,
        'suit_case_id' => $case->id,
    ])->assertCreated();

    $multimedia = Multimedia::first();

    // Participant can view
    actingAs($participant);
    getJson("/api/multimedia/{$multimedia->id}")->assertOk();

    // Outsider cannot view
    actingAs($outsider);
    getJson("/api/multimedia/{$multimedia->id}")->assertForbidden();
});
