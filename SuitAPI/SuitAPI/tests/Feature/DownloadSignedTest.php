<?php

use App\Models\File;
use App\Models\Multimedia;
use App\Models\PublicFile;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'admin']);
    Storage::fake('public_files');
    Storage::fake('local');
});

it('shows download page for public files and then downloads it', function () {
    $publicFile = PublicFile::create([
        'uuid' => (string) \Illuminate\Support\Str::uuid(),
        'user_id' => $this->user->id,
        'name' => 'test_public.txt',
        'path' => 'test_public.txt',
        'mime_type' => 'text/plain',
        'size' => 1024,
        'hash' => 'fakehash',
    ]);
    Storage::disk('public_files')->put('test_public.txt', 'public content');

    // Generate signed URL
    $response = actingAs($this->user)
        ->getJson("/api/public-files/{$publicFile->id}/generate-link");

    $signedUrl = $response->json('signed_url');

    // 1. Visit signed URL - should see the Blade view
    get($signedUrl)
        ->assertOk()
        ->assertViewIs('download')
        ->assertSee('test_public.txt')
        ->assertSee('Biblioteca Pública');

    // 2. Click download (add confirmed=1) - should download the file
    get($signedUrl.'&confirmed=1')
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename=test_public.txt');
});

it('shows download page for case files and then downloads it', function () {
    $case = SuitCase::factory()->create(['lawyer_id' => $this->user->id]);
    $content = 'case content';
    $encryptionService = app(\App\Services\FileEncryptionService::class);
    $encrypted = $encryptionService->encrypt($content);

    $file = File::create([
        'suit_case_id' => $case->id,
        'user_id' => $this->user->id,
        'filename' => 'case_file.pdf',
        'path' => 'secure_files/case_file.pdf',
        'mime_type' => 'application/pdf',
        'size' => strlen($content),
        'hash' => hash('sha256', $content),
        'encryption_iv' => $encrypted['iv'],
    ]);
    Storage::disk('local')->put($file->path, $encrypted['content']);

    // Generate signed URL
    $response = actingAs($this->user)
        ->postJson("/api/suit-cases/{$case->id}/generate-link", [
            'type' => 'download',
            'model_type' => 'file',
            'model_id' => $file->id,
        ]);

    $signedUrl = $response->json('download_url');

    // 1. Visit signed URL - should see the Blade view
    get($signedUrl)
        ->assertOk()
        ->assertViewIs('download')
        ->assertSee('case_file.pdf')
        ->assertSee('Archivo de Caso');

    // 2. Click download (add confirmed=1) - should download the file
    get($signedUrl.'&confirmed=1')
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="case_file.pdf"');
});

it('shows download page for multimedia and then downloads it', function () {
    $case = SuitCase::factory()->create(['lawyer_id' => $this->user->id]);
    $content = 'video content';
    $encryptionService = app(\App\Services\FileEncryptionService::class);
    $encrypted = $encryptionService->encrypt($content);

    $multimedia = Multimedia::create([
        'suit_case_id' => $case->id,
        'user_id' => $this->user->id,
        'filename' => 'video.mp4',
        'path' => 'secure_media/video.mp4',
        'mime_type' => 'video/mp4',
        'size' => strlen($content),
        'hash' => hash('sha256', $content),
        'encryption_iv' => $encrypted['iv'],
    ]);
    Storage::disk('local')->put($multimedia->path, $encrypted['content']);

    // Generate signed URL
    $response = actingAs($this->user)
        ->postJson("/api/suit-cases/{$case->id}/generate-link", [
            'type' => 'download',
            'model_type' => 'multimedia',
            'model_id' => $multimedia->id,
        ]);

    $signedUrl = $response->json('download_url');

    // 1. Visit signed URL - should see the Blade view
    get($signedUrl)
        ->assertOk()
        ->assertViewIs('download')
        ->assertSee('video.mp4')
        ->assertSee('Multimedia de Caso');

    // 2. Click download (add confirmed=1) - should download the file
    get($signedUrl.'&confirmed=1')
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="video.mp4"');
});

it('prevents download if signature is tampered with', function () {
    $publicFile = PublicFile::create([
        'uuid' => (string) \Illuminate\Support\Str::uuid(),
        'user_id' => $this->user->id,
        'name' => 'secret.txt',
        'path' => 'secret.txt',
        'mime_type' => 'text/plain',
        'size' => 1024,
        'hash' => 'fakehash',
    ]);

    $response = actingAs($this->user)
        ->getJson("/api/public-files/{$publicFile->id}/generate-link");

    $signedUrl = $response->json('signed_url');

    // Tamper with the ID in the URL path
    $wrongId = $publicFile->id + 1;
    $tamperedUrl = str_replace("/public-files/{$publicFile->id}/", "/public-files/{$wrongId}/", $signedUrl);

    get($tamperedUrl)->assertStatus(403);
});
