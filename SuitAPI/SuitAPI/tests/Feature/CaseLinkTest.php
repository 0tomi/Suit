<?php

use App\Models\File;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->owner = User::factory()->create(['role' => 'lawyer']);
    $this->participantRead = User::factory()->create();
    $this->participantWrite = User::factory()->create();
    $this->stranger = User::factory()->create();

    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->owner->id]);

    // Add participants
    $this->case->participants()->attach($this->participantRead->id, ['permission_level' => 'read']);
    $this->case->participants()->attach($this->participantWrite->id, ['permission_level' => 'write']);

    Storage::fake('local');
});

it('allows a participant to generate a download link', function () {
    $file = File::factory()->create(['suit_case_id' => $this->case->id]);

    actingAs($this->participantRead)
        ->postJson("/api/suit-cases/{$this->case->id}/generate-link", [
            'type' => 'download',
            'model_type' => 'file',
            'model_id' => $file->id,
        ])
        ->assertSuccessful()
        ->assertJsonStructure(['download_url', 'expires_at']);
});

it('prevents a non-participant from generating a download link', function () {
    $file = File::factory()->create(['suit_case_id' => $this->case->id]);

    actingAs($this->stranger)
        ->postJson("/api/suit-cases/{$this->case->id}/generate-link", [
            'type' => 'download',
            'model_type' => 'file',
            'model_id' => $file->id,
        ])
        ->assertForbidden();
});

it('allows a participant with write access to generate an upload link', function () {
    actingAs($this->participantWrite)
        ->postJson("/api/suit-cases/{$this->case->id}/generate-link", [
            'type' => 'upload',
            'model_type' => 'file',
        ])
        ->assertSuccessful()
        ->assertJsonStructure(['upload_url', 'expires_at']);
});

it('prevents a participant with read-only access from generating an upload link', function () {
    actingAs($this->participantRead)
        ->postJson("/api/suit-cases/{$this->case->id}/generate-link", [
            'type' => 'upload',
            'model_type' => 'file',
        ])
        ->assertForbidden();
});

it('allows uploading a physical file via signed link to the correct case', function () {
    // Generate upload link
    $response = actingAs($this->owner)
        ->postJson("/api/suit-cases/{$this->case->id}/generate-link", [
            'type' => 'upload',
            'model_type' => 'multimedia',
        ]);

    $uploadUrl = $response->json('upload_url');

    // Mock FileEncryptionService behavior for the test (FileService uses it)
    $file = UploadedFile::fake()->image('video.mp4');

    $this->postJson($uploadUrl, ['files' => [$file]])
        ->assertCreated()
        ->assertJsonPath('0.filename', 'video.mp4');

    assertDatabaseHas('multimedia', [
        'filename' => 'video.mp4',
        'suit_case_id' => $this->case->id,
        'user_id' => $this->owner->id, // attributed to generator
    ]);
});

it('invalidates the case upload if case_id is tampered with', function () {
    $otherCase = SuitCase::factory()->create(['lawyer_id' => $this->owner->id]);

    $response = actingAs($this->owner)
        ->postJson("/api/suit-cases/{$this->case->id}/generate-link", [
            'type' => 'upload',
            'model_type' => 'file',
        ]);

    $uploadUrl = $response->json('upload_url');

    // Tamper with case_id in the URL
    $tamperedUrl = str_replace("case_id={$this->case->id}", "case_id={$otherCase->id}", $uploadUrl);

    $file = UploadedFile::fake()->create('hacked.txt');

    $this->postJson($tamperedUrl, ['files' => [$file]])
        ->assertStatus(403);
});
