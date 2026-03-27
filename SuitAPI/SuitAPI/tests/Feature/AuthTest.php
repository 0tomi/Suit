<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('can register a user with only required fields', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $payload = [
        'tag' => 'lawyer01',
        'name' => 'John Doe',
        'password' => 'password123',
        'role' => 'lawyer',
    ];

    $response = $this->actingAs($admin)->postJson('/api/register', $payload);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'access_token',
            'token_type',
            'user' => [
                'id',
                'name',
                'tag',
                'role',
            ],
        ]);

    $this->assertDatabaseHas('users', [
        'tag' => 'lawyer01',
        'name' => 'John Doe',
        'email' => null,
    ]);
});

it('can register a user with email and photo', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Storage::fake('public');
    $photo = UploadedFile::fake()->image('profile.jpg');

    $payload = [
        'tag' => 'lawyer02',
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'securepassword',
        'role' => 'admin',
        'photo' => $photo,
    ];

    $response = $this->actingAs($admin)->postJson('/api/register', $payload);

    $response->assertStatus(200);

    $user = User::where('tag', 'lawyer02')->first();

    $this->assertDatabaseHas('users', [
        'tag' => 'lawyer02',
        'email' => 'jane@example.com',
    ]);

    expect($user->profile_photo_path)->not->toBeNull();
    Storage::disk('public')->assertExists($user->profile_photo_path);
});

it('validates duplicate tag on registration', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    User::factory()->create([
        'tag' => 'existing_tag',
    ]);

    $payload = [
        'tag' => 'existing_tag',
        'name' => 'New User',
        'password' => 'password123',
        'role' => 'user',
    ];

    $response = $this->actingAs($admin)->postJson('/api/register', $payload);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['tag']);
});
