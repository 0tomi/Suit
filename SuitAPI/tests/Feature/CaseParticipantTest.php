<?php

use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('can add participant by user tag', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $userToAdd = User::factory()->create(['tag' => '#USER123']);

    $case = SuitCase::factory()->create([
        'title' => 'Collab Test',
        'lawyer_id' => $lawyer->id, // Lawyer is creator
        'status' => 'active',
        'start_date' => now(), // Assuming factory or default
    ]);

    $response = $this->actingAs($lawyer)->postJson("/api/cases/{$case->id}/participants", [
        'user_tag' => '#USER123',
        'permission_level' => 'read',
    ]);

    $response->assertStatus(200);

    $this->assertDatabaseHas('case_permissions', [
        'suit_case_id' => $case->id,
        'user_id' => $userToAdd->id,
        'permission_level' => 'read',
    ]);
});

test('cannot add participant with invalid tag', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create([
        'title' => 'Collab Test',
        'lawyer_id' => $lawyer->id,
        'status' => 'active',
        'start_date' => now(),
    ]);

    $response = $this->actingAs($lawyer)->postJson("/api/cases/{$case->id}/participants", [
        'user_tag' => '#INVALID',
        'permission_level' => 'read',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['user_tag']);
});

test('get participants returns owner and regular participants', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['tag' => '#PART001']);

    $case = SuitCase::factory()->create([
        'title' => 'Participants Test',
        'lawyer_id' => $lawyer->id,
        'status' => 'active',
        'start_date' => now(),
    ]);

    $case->participants()->attach($participant->id, ['permission_level' => 'read']);

    $response = $this->actingAs($lawyer)->getJson("/api/cases/{$case->id}/participants");

    $response->assertStatus(200)
        ->assertJsonCount(2)
        ->assertJsonFragment([
            'id' => $lawyer->id,
            'permission_level' => 'owner',
        ])
        ->assertJsonFragment([
            'id' => $participant->id,
            'permission_level' => 'read',
        ]);
});

test('get participants returns only owner when no other participants', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);

    $case = SuitCase::factory()->create([
        'title' => 'Solo Owner Test',
        'lawyer_id' => $lawyer->id,
        'status' => 'active',
        'start_date' => now(),
    ]);

    $response = $this->actingAs($lawyer)->getJson("/api/cases/{$case->id}/participants");

    $response->assertStatus(200)
        ->assertJsonCount(1)
        ->assertJsonFragment([
            'id' => $lawyer->id,
            'permission_level' => 'owner',
        ]);
});
