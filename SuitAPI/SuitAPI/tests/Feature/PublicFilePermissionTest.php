<?php

use App\Models\PublicFile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

test('owner can grant update permission to another user', function () {
    $owner = User::factory()->create();
    $testUser = User::factory()->create();
    $file = PublicFile::factory()->create(['user_id' => $owner->id]);

    Sanctum::actingAs($owner);

    $response = $this->postJson("/api/public-files/{$file->id}/permissions", [
        'user_id' => $testUser->id,
        'can_update' => true,
        'can_delete' => false,
    ]);

    $response->assertStatus(200);
    $this->assertDatabaseHas('public_file_permissions', [
        'public_file_id' => $file->id,
        'user_id' => $testUser->id,
        'can_update' => true,
        'can_delete' => false,
    ]);
});

test('user with update permission can update the file', function () {
    $owner = User::factory()->create();
    $testUser = User::factory()->create();
    $file = PublicFile::factory()->create(['user_id' => $owner->id, 'name' => 'Original Name']);

    // Grant permission
    $file->permissions()->create([
        'user_id' => $testUser->id,
        'can_update' => true,
        'can_delete' => false,
    ]);

    Sanctum::actingAs($testUser);

    $response = $this->putJson("/api/public-files/{$file->id}", [
        'name' => 'Updated Name',
    ]);

    $response->assertStatus(200);
    $this->assertDatabaseHas('public_files', [
        'id' => $file->id,
        'name' => 'Updated Name',
    ]);
});

test('user without permissions cannot update the file', function () {
    $owner = User::factory()->create();
    $unauthorizedUser = User::factory()->create();
    $file = PublicFile::factory()->create(['user_id' => $owner->id, 'name' => 'Original Name']);

    Sanctum::actingAs($unauthorizedUser);

    $response = $this->putJson("/api/public-files/{$file->id}", [
        'name' => 'I Try To Update',
    ]);

    $response->assertStatus(403);
});

test('user with update but without delete permission cannot delete the file', function () {
    $owner = User::factory()->create();
    $testUser = User::factory()->create();
    $file = PublicFile::factory()->create(['user_id' => $owner->id]);

    // Grant update only
    $file->permissions()->create([
        'user_id' => $testUser->id,
        'can_update' => true,
        'can_delete' => false,
    ]);

    Sanctum::actingAs($testUser);

    $response = $this->deleteJson("/api/public-files/{$file->id}");

    $response->assertStatus(403);
    $this->assertDatabaseHas('public_files', [
        'id' => $file->id,
        'deleted_at' => null,
    ]);
});

test('user can check their own permissions on a file', function () {
    $owner = User::factory()->create();
    $testUser = User::factory()->create();
    $file = PublicFile::factory()->create(['user_id' => $owner->id]);

    // Scenario 1: No permissions
    Sanctum::actingAs($testUser);
    $response = $this->getJson("/api/public-files/{$file->id}/my-permissions");
    $response->assertStatus(200)
        ->assertJson([
            'can_update' => false,
            'can_delete' => false,
        ]);

    // Scenario 2: With update permission only
    $file->permissions()->create([
        'user_id' => $testUser->id,
        'can_update' => true,
        'can_delete' => false,
    ]);

    $response = $this->getJson("/api/public-files/{$file->id}/my-permissions");
    $response->assertStatus(200)
        ->assertJson([
            'can_update' => true,
            'can_delete' => false,
        ]);

    // Scenario 3: Owner has full permissions
    Sanctum::actingAs($owner);
    $response = $this->getJson("/api/public-files/{$file->id}/my-permissions");
    $response->assertStatus(200)
        ->assertJson([
            'can_update' => true,
            'can_delete' => true,
        ]);
});
