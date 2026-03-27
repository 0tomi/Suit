<?php

use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function createManualSignedUrl(string $routeName, int $expirationMinutes, array $params = []): string
{
    $params['expires'] = now()->addMinutes($expirationMinutes)->timestamp;

    // Sort all parameters including 'expires'
    ksort($params);

    $data = $routeName.'|'.http_build_query($params);
    $key = config('app.key');
    if (Str::startsWith($key, 'base64:')) {
        $key = base64_decode(substr($key, 7));
    }
    $params['signature'] = hash_hmac('sha256', $data, $key);

    return route($routeName, $params);
}

beforeEach(function () {
    Storage::fake('public_files');
    Storage::fake('cases');
});

test('public file upload signed route returns html view on GET', function () {
    $user = User::factory()->create();

    $url = createManualSignedUrl(
        'public-files.upload-signed',
        15,
        ['generator_id' => $user->id]
    );

    $response = $this->get($url);

    $response->assertStatus(200);
    $response->assertViewIs('upload');
    $this->assertTrue(str_contains($response->getContent(), 'Biblioteca Pública'));
});

test('public file upload signed route processes multiple files on POST', function () {
    $user = User::factory()->create();

    $url = createManualSignedUrl(
        'public-files.upload-signed',
        15,
        ['generator_id' => $user->id]
    );

    $file1 = UploadedFile::fake()->create('document1.pdf', 100);
    $file2 = UploadedFile::fake()->create('document2.txt', 50);

    $response = $this->postJson($url, [
        'files' => [$file1, $file2],
    ]);

    $response->assertStatus(200);
    $this->assertDatabaseHas('public_files', [
        'name' => 'document1.pdf',
        'user_id' => $user->id,
    ]);
    $this->assertDatabaseHas('public_files', [
        'name' => 'document2.txt',
        'user_id' => $user->id,
    ]);
});

test('case file upload signed route returns html view on GET', function () {
    $user = User::factory()->create();
    $suitCase = SuitCase::factory()->create();

    $url = createManualSignedUrl(
        'cases.upload-signed',
        15,
        [
            'case_id' => $suitCase->id,
            'model_type' => 'file',
            'generator_id' => $user->id,
        ]
    );

    $response = $this->get($url);

    $response->assertStatus(200);
    $response->assertViewIs('upload');
    $this->assertTrue(str_contains($response->getContent(), 'Archivos de Caso'));
});

test('case file upload signed route processes multiple files on POST', function () {
    $user = User::factory()->create();
    $suitCase = SuitCase::factory()->create();

    $url = createManualSignedUrl(
        'cases.upload-signed',
        15,
        [
            'case_id' => $suitCase->id,
            'model_type' => 'file',
            'generator_id' => $user->id,
        ]
    );

    $file1 = UploadedFile::fake()->create('doc1.pdf', 100);
    $file2 = UploadedFile::fake()->create('doc2.pdf', 100);

    $response = $this->postJson($url, [
        'files' => [$file1, $file2],
    ]);

    $response->assertStatus(201);
    $this->assertDatabaseHas('files', [
        'filename' => 'doc1.pdf',
        'suit_case_id' => $suitCase->id,
    ]);
    $this->assertDatabaseHas('files', [
        'filename' => 'doc2.pdf',
        'suit_case_id' => $suitCase->id,
    ]);
});

test('case multimedia upload signed route returns html view on GET', function () {
    $user = User::factory()->create();
    $suitCase = SuitCase::factory()->create();

    $url = createManualSignedUrl(
        'cases.upload-signed',
        15,
        [
            'case_id' => $suitCase->id,
            'model_type' => 'multimedia',
            'generator_id' => $user->id,
        ]
    );

    $response = $this->get($url);

    $response->assertStatus(200);
    $response->assertViewIs('upload');
    $this->assertTrue(str_contains($response->getContent(), 'Multimedia de Caso'));
});

test('invalid signature returns custom error view on GET', function () {
    $url = url('/api/public-files/upload-signed?signature=invalid');

    $response = $this->get($url);

    $response->assertStatus(403);
    $response->assertViewIs('errors.invalid-signature');
    $response->assertSee('Enlace no válido o expirado');
});
