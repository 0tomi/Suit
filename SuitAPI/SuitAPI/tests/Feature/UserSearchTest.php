<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('authenticated user can list users', function () {
    User::factory()->count(20)->create();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->getJson('/api/users');

    $response->assertStatus(200)
        ->assertJsonCount(15, 'data'); // Pagination default 15
});

test('can search users by name', function () {
    User::factory()->create(['name' => 'John Doe']);
    User::factory()->create(['name' => 'Jane Doe']);
    $user = User::factory()->create(['name' => 'Alice']);

    $response = $this->actingAs($user)->getJson('/api/users/search?query=John');

    $response->assertStatus(200)
        ->assertJsonFragment(['name' => 'John Doe'])
        ->assertJsonMissing(['name' => 'Jane Doe']);
});

test('can search users by tag', function () {
    User::factory()->create(['tag' => '#JOHN123']);
    $user = User::factory()->create(['tag' => '#ALICE']);

    $response = $this->actingAs($user)->getJson('/api/users/search?query=JOHN123');

    $response->assertStatus(200)
        ->assertJsonFragment(['tag' => '#JOHN123']);
});
