<?php

use App\Models\Bitacora;
use App\Models\CaseType;
use App\Models\Radicacion;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('admins can view bitacora logs', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Bitacora::factory()->count(5)->create(['user_id' => $admin->id]);

    $response = $this->actingAs($admin)->getJson('/api/bitacora');

    $response->assertStatus(200)
        ->assertJsonCount(5, 'data')
        ->assertJsonStructure(['data' => [['id', 'user', 'action', 'entity_id', 'entity_type', 'created_at']]]);
});

test('non-admins cannot view bitacora logs', function () {
    $user = User::factory()->create(['role' => 'lawyer']);

    $response = $this->actingAs($user)->getJson('/api/bitacora');

    $response->assertStatus(403);
});

test('it records an action when a case is created', function () {
    $user = User::factory()->create(['role' => 'admin']);
    $caseType = CaseType::factory()->create();
    $radicacion = Radicacion::factory()->create(['tipo' => 'Provincial']);

    $response = $this->actingAs($user)->postJson('/api/cases', [
        'title' => 'Test Case',
        'case_type_id' => $caseType->id,
        'start_date' => now()->format('Y-m-d'),
        'nro_expediente' => '123/2026',
        'radicacion_id' => $radicacion->id,
    ]);

    $response->assertStatus(201);

    $this->assertDatabaseHas('bitacoras', [
        'user_id' => $user->id,
        'action' => 'created',
        'entity_type' => 'case',
    ]);
});

test('it records an action when a case is updated', function () {
    $user = User::factory()->create(['role' => 'admin']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $response = $this->actingAs($user)->putJson("/api/cases/{$case->id}", [
        'title' => 'Updated Title',
        'nro_expediente' => $case->nro_expediente,
        'radicacion_id' => $case->radicacion_id,
    ]);

    $response->assertStatus(200);

    $this->assertDatabaseHas('bitacoras', [
        'user_id' => $user->id,
        'action' => 'updated',
        'entity_id' => $case->id,
        'entity_type' => 'case',
    ]);
});

test('it records an action when a case is deleted', function () {
    $user = User::factory()->create(['role' => 'admin']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $response = $this->actingAs($user)->deleteJson("/api/cases/{$case->id}");

    $response->assertStatus(204);

    $this->assertDatabaseHas('bitacoras', [
        'user_id' => $user->id,
        'action' => 'deleted',
        'entity_id' => $case->id,
        'entity_type' => 'case',
    ]);
});

test('admins can clear the bitacora', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Bitacora::factory()->count(10)->create(['user_id' => $admin->id]);

    $response = $this->actingAs($admin)->deleteJson('/api/bitacora/clear');

    $response->assertStatus(200);
    $this->assertDatabaseCount('bitacoras', 0);
});

test('admins can cleanup the bitacora by days', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    // Create old logs
    $oldLog = Bitacora::factory()->create([
        'user_id' => $admin->id,
        'created_at' => now()->subDays(40),
    ]);

    // Create new logs
    $newLog = Bitacora::factory()->create([
        'user_id' => $admin->id,
        'created_at' => now()->subDays(10),
    ]);

    $response = $this->actingAs($admin)->deleteJson('/api/bitacora/cleanup', ['days' => 30]);

    $response->assertStatus(200);
    $this->assertDatabaseMissing('bitacoras', ['id' => $oldLog->id]);
    $this->assertDatabaseHas('bitacoras', ['id' => $newLog->id]);
});
