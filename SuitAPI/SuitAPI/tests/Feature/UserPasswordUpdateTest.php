<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

test('a user can update their own password via profile endpoint', function () {
    $user = User::factory()->create([
        'password' => 'old_password',
    ]);

    $response = $this->actingAs($user)->putJson('/api/user/profile', [
        'password' => 'new_password123',
    ]);

    $response->assertOk();

    $user->refresh();
    expect(Hash::check('new_password123', $user->password))->toBeTrue();
});

test('a user can update their own email via profile endpoint', function () {
    $user = User::factory()->create([
        'email' => 'old@example.com',
    ]);

    $response = $this->actingAs($user)->putJson('/api/user/profile', [
        'email' => 'new@example.com',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->email)->toBe('new@example.com');
});

test('a user can update their own password via tag endpoint', function () {
    $user = User::factory()->create([
        'password' => 'old_password',
        'tag' => 'mytag',
    ]);

    $response = $this->actingAs($user)->putJson("/api/users/tag/{$user->tag}", [
        'password' => 'new_password123',
    ]);

    $response->assertOk();

    $user->refresh();
    expect(Hash::check('new_password123', $user->password))->toBeTrue();
});

test('an admin can update another user password', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create([
        'password' => 'old_password',
        'tag' => 'usertag',
    ]);

    $response = $this->actingAs($admin)->putJson("/api/users/tag/{$user->tag}", [
        'password' => 'admin_set_password',
    ]);

    $response->assertOk();

    $user->refresh();
    expect(Hash::check('admin_set_password', $user->password))->toBeTrue();
});

test('admin can update tag', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['tag' => 'ORIGINAL_TAG']);

    $response = $this->actingAs($admin)->putJson("/api/users/tag/{$user->tag}", [
        'tag' => 'NEW_TAG',
        'name' => 'New Name',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->tag)->toBe('NEW_TAG'); // Tag should be changed
    expect($user->name)->toBe('New Name');
});

test('normal user cannot update their own tag', function () {
    $user = User::factory()->create(['tag' => 'original-tag', 'role' => 'user']);

    $response = $this->actingAs($user)->putJson("/api/users/tag/{$user->tag}", [
        'tag' => 'new-tag',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->tag)->toBe('original-tag'); // Tag should remain unchanged
});

test('normal user cannot change their own role', function () {
    $user = User::factory()->create(['role' => 'user', 'tag' => 'mytag']);

    $response = $this->actingAs($user)->putJson("/api/users/tag/{$user->tag}", [
        'role' => 'admin',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->role)->toBe('user'); // Role should remain unchanged
});

test('admin can change another user role', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user', 'tag' => 'usertag']);

    $response = $this->actingAs($admin)->putJson("/api/users/tag/{$user->tag}", [
        'role' => 'lawyer',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->role)->toBe('lawyer');
});

test('password must be at least 8 characters', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->putJson('/api/user/profile', [
        'password' => 'short',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});
