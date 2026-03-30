<?php

use App\Models\PublicFile;
use App\Models\PublicFileCatalog;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertSoftDeleted;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    Storage::fake('public_files');
});

it('prevents guests from accessing public files endpoints', function () {
    getJson('/api/public-file-catalogs/1/public-files')->assertUnauthorized();
    postJson('/api/public-files')->assertUnauthorized();
    getJson('/api/public-files/last-modified')->assertUnauthorized();
});

it('lists public files paginated and ordered by latest', function () {
    $catalog = PublicFileCatalog::create(['name' => 'Tests Catalog']);
    $file1 = PublicFile::factory()->create(['user_id' => $this->user->id, 'public_file_catalog_id' => $catalog->id, 'created_at' => now()->subDay()]);
    $file2 = PublicFile::factory()->create(['user_id' => $this->user->id, 'public_file_catalog_id' => $catalog->id, 'created_at' => now()]);

    actingAs($this->user)
        ->getJson("/api/public-file-catalogs/{$catalog->id}/public-files")
        ->assertSuccessful()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.1.id', $file1->id);
});

it('lists all public files paginated and ordered by latest', function () {
    $catalog1 = PublicFileCatalog::create(['name' => 'Catalog 1']);
    $catalog2 = PublicFileCatalog::create(['name' => 'Catalog 2']);

    $file1 = PublicFile::factory()->create(['user_id' => $this->user->id, 'public_file_catalog_id' => $catalog1->id, 'created_at' => now()->subDay()]);
    $file2 = PublicFile::factory()->create(['user_id' => $this->user->id, 'public_file_catalog_id' => $catalog2->id, 'created_at' => now()]);

    actingAs($this->user)
        ->getJson('/api/public-files')
        ->assertSuccessful()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $file2->id)
        ->assertJsonPath('data.1.id', $file1->id);
});

it('lists public files filtered by catalog_id query parameter', function () {
    $catalog1 = PublicFileCatalog::create(['name' => 'Catalog 1']);
    $catalog2 = PublicFileCatalog::create(['name' => 'Catalog 2']);

    $file1 = PublicFile::factory()->create(['user_id' => $this->user->id, 'public_file_catalog_id' => $catalog1->id]);
    $file2 = PublicFile::factory()->create(['user_id' => $this->user->id, 'public_file_catalog_id' => $catalog2->id]);

    actingAs($this->user)
        ->getJson("/api/public-files?public_file_catalog_id={$catalog1->id}")
        ->assertSuccessful()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $file1->id);
});

it('allows authenticated users to upload a public file', function () {
    $file = UploadedFile::fake()->image('test_image.jpg')->size(100);

    actingAs($this->user)
        ->postJson('/api/public-files', ['file' => $file])
        ->assertCreated()
        ->assertJsonStructure(['data' => ['id', 'name', 'url']]);

    assertDatabaseHas('public_files', [
        'name' => 'test_image.jpg',
        'mime_type' => 'image/jpeg',
        'size' => 102400, // 100 KB in bytes
    ]);

    $publicFile = PublicFile::first();
    Storage::disk('public_files')->assertExists($publicFile->path);
});

it('allows uploading .odp files', function () {
    $file = UploadedFile::fake()->create('presentation.odp', 100);

    actingAs($this->user)
        ->postJson('/api/public-files', ['file' => $file])
        ->assertCreated();

    assertDatabaseHas('public_files', [
        'name' => 'presentation.odp',
    ]);
});

it('fails to upload if no file is provided', function () {
    actingAs($this->user)
        ->postJson('/api/public-files', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file']);
});

it('fails to upload if the file format is not allowed', function () {
    $file = UploadedFile::fake()->create('unsupported.exe', 100);

    actingAs($this->user)
        ->postJson('/api/public-files', ['file' => $file])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file']);
});

it('allows authenticated users to view a specific public file', function () {
    $publicFile = PublicFile::factory()->create(['user_id' => $this->user->id]);

    actingAs($this->user)
        ->getJson("/api/public-files/{$publicFile->id}")
        ->assertSuccessful()
        ->assertJson([
            'data' => [
                'id' => $publicFile->id,
                'name' => $publicFile->name,
            ],
        ]);
});

it('returns 404 when viewing a non-existent public file', function () {
    actingAs($this->user)
        ->getJson('/api/public-files/non-existent-uuid')
        ->assertNotFound();
});

it('allows authenticated users to update a public file name', function () {
    $publicFile = PublicFile::factory()->create(['user_id' => $this->user->id]);

    actingAs($this->user)
        ->putJson("/api/public-files/{$publicFile->id}", [
            'name' => 'new_name.txt',
        ])
        ->assertSuccessful()
        ->assertJson([
            'data' => [
                'name' => 'new_name.txt',
            ],
        ]);

    assertDatabaseHas('public_files', ['id' => $publicFile->id, 'name' => 'new_name.txt']);
});

it('fails to update if name exceeds 255 characters', function () {
    $publicFile = PublicFile::factory()->create(['user_id' => $this->user->id]);

    actingAs($this->user)
        ->putJson("/api/public-files/{$publicFile->id}", [
            'name' => str_repeat('a', 256),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);
});

it('allows authenticated users to soft delete a public file', function () {
    $publicFile = PublicFile::factory()->create(['user_id' => $this->user->id]);

    actingAs($this->user)
        ->deleteJson("/api/public-files/{$publicFile->id}")
        ->assertNoContent();

    assertSoftDeleted('public_files', ['id' => $publicFile->id]);
});

it('returns 404 when trying to view a soft-deleted public file', function () {
    $publicFile = PublicFile::factory()->create(['user_id' => $this->user->id]);
    $publicFile->delete();

    actingAs($this->user)
        ->getJson("/api/public-files/{$publicFile->id}")
        ->assertNotFound();
});

it('returns the latest update timestamp for last-modified endpoint', function () {
    actingAs($this->user)
        ->getJson('/api/public-files/last-modified')
        ->assertSuccessful()
        ->assertJson(['last_modified' => null]);

    $file = PublicFile::factory()->create(['user_id' => $this->user->id]);

    $this->travel(5)->minutes();

    $file->update(['name' => 'updated.txt']);

    actingAs($this->user)
        ->getJson('/api/public-files/last-modified')
        ->assertSuccessful()
        ->assertJson(['last_modified' => $file->updated_at->toIso8601String()]);
});
