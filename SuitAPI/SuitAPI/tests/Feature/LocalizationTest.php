<?php

use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\postJson;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('returns validation errors in Spanish', function () {
    $user = User::factory()->create();

    // Sending invalid data to a route that requires validation
    actingAs($user)
        ->postJson('/api/public-files/generate-upload-link', [
            'public_file_catalog_id' => 'invalid', // should be integer
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['public_file_catalog_id'])
        ->assertJsonFragment([
            'message' => 'El ID de catálogo seleccionado es inválido.',
        ]);
});

it('returns auth validation errors in Spanish', function () {
    // Test with missing password to see generic required message
    postJson('/api/login', [
        'tag' => 'some-tag',
    ])
        ->assertStatus(422)
        ->assertJsonFragment([
            'message' => 'El campo contraseña es obligatorio.',
        ]);

    // Test with missing tag
    postJson('/api/login', [
        'password' => 'some-password',
    ])
        ->assertStatus(422)
        ->assertJsonFragment([
            'message' => 'El campo tag es obligatorio.',
        ]);
});
