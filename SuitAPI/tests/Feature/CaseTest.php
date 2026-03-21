<?php

use App\Models\CaseType;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('can create a case with correct date format', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::create(['name' => 'Civil']);

    $response = $this->actingAs($user)->postJson('/api/cases', [
        'title' => 'Test Case',
        'case_type_id' => $type->id,
        'start_date' => '2023-12-01',
        'details' => 'Some details',
        'nro_expediente' => 'EXP-CASE-123',
        'radicacion_id' => \App\Models\Radicacion::factory()->create()->id,
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'case' => ['id', 'title', 'start_date', 'status'],
            'agenda' => ['id', 'name', 'suit_case_id', 'user_id'],
            'cases_last_modified',
            'agendas_last_modified',
        ])
        ->assertJsonFragment([
            'start_date' => '2023-12-01',
            'status' => 'active',
        ]);

    $this->assertDatabaseHas('suit_cases', [
        'title' => 'Test Case',
        'start_date' => '2023-12-01',
        'case_type_id' => $type->id,
        'nro_expediente' => 'EXP-CASE-123',
    ]);

    // Owner should NOT be stored as a participant in case_permissions
    $this->assertDatabaseMissing('case_permissions', [
        'suit_case_id' => $response->json('id'),
        'user_id' => $user->id,
        'permission_level' => 'owner',
    ]);
});

test('cannot create a case with invalid date format', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::create(['name' => 'Civil']);

    $response = $this->actingAs($user)->postJson('/api/cases', [
        'title' => 'Test Case',
        'case_type_id' => $type->id,
        'start_date' => '01-12-2023', // Invalid format
        'details' => 'Some details',
        'nro_expediente' => 'EXP-CASE-INVALID',
        'radicacion_id' => \App\Models\Radicacion::factory()->create()->id,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['start_date']);
});

test('dates are cast to date objects without time', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::create(['name' => 'Criminal']);

    $case = SuitCase::factory()->create([
        'title' => 'Date Test',
        'lawyer_id' => $user->id,
        'case_type_id' => $type->id,
        'start_date' => '2024-01-15',
        'status' => 'active',
    ]);

    // Refresh model to check DB value/cast
    $case->refresh();

    // In Laravel, date casting usually returns Carbon instance at 00:00:00
    expect($case->start_date->format('Y-m-d'))->toBe('2024-01-15');
});
