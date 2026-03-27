<?php

use App\Models\PublicFile;
use App\Models\PublicFileCatalog;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    Storage::fake('public_files');
});

it('allows generating a signed upload link for public files', function () {
    $catalog = PublicFileCatalog::create(['name' => 'Test Catalog']);

    actingAs($this->user)
        ->postJson('/api/public-files/generate-upload-link', [
            'public_file_catalog_id' => $catalog->id,
            'permissions' => [
                ['user_id' => $this->user->id, 'can_update' => true, 'can_delete' => false],
            ],
        ])
        ->assertSuccessful()
        ->assertJsonStructure(['upload_url', 'expires_at']);
});

it('allows uploading a file via a signed link and applies catalog and permissions', function () {
    $catalog = PublicFileCatalog::create(['name' => 'Test Catalog']);
    $otherUser = User::factory()->create();

    // Generate link
    $response = actingAs($this->user)
        ->postJson('/api/public-files/generate-upload-link', [
            'public_file_catalog_id' => $catalog->id,
            'permissions' => [
                ['user_id' => $otherUser->id, 'can_update' => true, 'can_delete' => true],
            ],
        ]);

    $uploadUrl = $response->json('upload_url');

    // Upload file (as guest, using the signed URL)
    $file = UploadedFile::fake()->create('shared.txt', 100);

    $this->postJson($uploadUrl, ['files' => [$file]])
        ->assertOk()
        ->assertJsonPath('data.0.name', 'shared.txt');

    assertDatabaseHas('public_files', [
        'name' => 'shared.txt',
        'public_file_catalog_id' => $catalog->id,
        'user_id' => $this->user->id, // attributed to the generator
    ]);

    $publicFile = PublicFile::where('name', 'shared.txt')->first();

    assertDatabaseHas('public_file_permissions', [
        'public_file_id' => $publicFile->id,
        'user_id' => $otherUser->id,
        'can_update' => 1,
        'can_delete' => 1,
    ]);
});

it('invalidates the signed upload if parameters are tampered with', function () {
    $catalog1 = PublicFileCatalog::create(['name' => 'Catalog 1']);
    $catalog2 = PublicFileCatalog::create(['name' => 'Catalog 2']);

    $response = actingAs($this->user)
        ->postJson('/api/public-files/generate-upload-link', [
            'public_file_catalog_id' => $catalog1->id,
        ]);

    $uploadUrl = $response->json('upload_url');

    // Attempt to change catalog_id in the URL
    $tamperedUrl = str_replace("public_file_catalog_id={$catalog1->id}", "public_file_catalog_id={$catalog2->id}", $uploadUrl);

    $file = UploadedFile::fake()->image('tampered.jpg');

    $this->postJson($tamperedUrl, ['files' => [$file]])
        ->assertStatus(403); // Signed middleware should block this
});
