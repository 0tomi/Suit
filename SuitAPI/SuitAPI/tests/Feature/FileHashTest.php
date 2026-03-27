<?php

use App\Models\File;
use App\Models\Multimedia;
use App\Models\PublicFile;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public_files');
    Storage::fake('local');
    $this->user = User::factory()->create(['role' => 'admin']);
    $this->suitCase = SuitCase::factory()->create(['lawyer_id' => $this->user->id]);
    $this->catalog = \App\Models\PublicFileCatalog::create(['name' => 'General']);
});

test('public files index includes hash and updated_by', function () {
    $this->actingAs($this->user);

    PublicFile::factory()->create([
        'user_id' => $this->user->id,
        'hash' => 'dummy-hash',
    ]);

    $response = $this->getJson('/api/public-file-catalogs/1/public-files');

    $response->assertStatus(200)
        ->assertJsonPath('data.0.hash', 'dummy-hash')
        ->assertJsonPath('data.0.updated_by', $this->user->id);
});

test('files index includes hash and updated_by', function () {
    $this->actingAs($this->user);

    File::factory()->create([
        'user_id' => $this->user->id,
        'suit_case_id' => $this->suitCase->id,
        'hash' => 'dummy-hash',
    ]);

    $response = $this->getJson('/api/files');

    $response->assertStatus(200)
        ->assertJsonPath('data.0.hash', 'dummy-hash')
        ->assertJsonPath('data.0.updated_by', $this->user->id);
});

test('multimedia index includes hash and updated_by', function () {
    $this->actingAs($this->user);

    Multimedia::factory()->create([
        'user_id' => $this->user->id,
        'suit_case_id' => $this->suitCase->id,
        'hash' => 'dummy-hash',
    ]);

    $response = $this->getJson('/api/multimedia');

    $response->assertStatus(200)
        ->assertJsonPath('data.0.hash', 'dummy-hash')
        ->assertJsonPath('data.0.updated_by', $this->user->id);
});

test('storing a file generates and returns sha256 hash and updated_by', function () {
    $file = UploadedFile::fake()->create('test.pdf', 100);
    $content = $file->get();
    $expectedHash = hash('sha256', $content);

    $response = $this->actingAs($this->user)
        ->postJson('/api/files', [
            'file' => $file,
            'suit_case_id' => $this->suitCase->id,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('hash', $expectedHash)
        ->assertJsonPath('updated_by', $this->user->id);
});

test('storing multimedia generates and returns sha256 hash and updated_by', function () {
    $file = UploadedFile::fake()->image('test.jpg');
    $content = $file->get();
    $expectedHash = hash('sha256', $content);

    $response = $this->actingAs($this->user)
        ->postJson('/api/multimedia', [
            'file' => $file,
            'suit_case_id' => $this->suitCase->id,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('hash', $expectedHash)
        ->assertJsonPath('updated_by', $this->user->id);
});
