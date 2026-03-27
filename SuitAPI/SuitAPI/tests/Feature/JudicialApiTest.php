<?php

use App\Models\CaseType;
use App\Models\Competencia;
use App\Models\DependenciaJudicial;
use App\Models\Jurisdiccion;
use App\Models\Radicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->user = User::factory()->create(['role' => 'user']);

    // Create Federal records
    Jurisdiccion::firstOrCreate(['nombre' => 'Federal']);
    Radicacion::firstOrCreate(['tipo' => 'Federal']);
});

test('authenticated users can list jurisdicciones', function () {
    Sanctum::actingAs($this->user);
    $response = $this->getJson('/api/jurisdicciones');
    $response->assertStatus(200);
});

test('admins and lawyers can create jurisdiccion', function () {
    Sanctum::actingAs($this->lawyer);
    $response = $this->postJson('/api/jurisdicciones', ['nombre' => 'Provincial Test']);
    $response->assertStatus(201);
    $this->assertDatabaseHas('jurisdicciones', ['nombre' => 'Provincial Test']);
});

test('users cannot create jurisdiccion', function () {
    Sanctum::actingAs($this->user);
    $response = $this->postJson('/api/jurisdicciones', ['nombre' => 'Forbidden']);
    $response->assertStatus(403);
});

test('federal records are protected from update', function () {
    Sanctum::actingAs($this->admin);

    $federalJurisdiccion = Jurisdiccion::where('nombre', 'Federal')->firstOrFail();
    $federalRadicacion = Radicacion::where('tipo', 'Federal')->firstOrFail();

    // Test Jurisdiccion protection
    $response = $this->putJson("/api/jurisdicciones/{$federalJurisdiccion->id}", ['nombre' => 'Changed']);
    $response->assertStatus(403);

    // Test Radicacion protection
    $response = $this->putJson("/api/radicaciones/{$federalRadicacion->id}", ['tipo' => 'Changed']);
    $response->assertStatus(403);
});

test('federal records are protected from deletion', function () {
    Sanctum::actingAs($this->admin);

    $federalJurisdiccion = Jurisdiccion::where('nombre', 'Federal')->firstOrFail();
    $federalRadicacion = Radicacion::where('tipo', 'Federal')->firstOrFail();

    // Test Jurisdiccion protection
    $response = $this->deleteJson("/api/jurisdicciones/{$federalJurisdiccion->id}");
    $response->assertStatus(403);

    // Test Radicacion protection
    $response = $this->deleteJson("/api/radicaciones/{$federalRadicacion->id}");
    $response->assertStatus(403);
});

test('judicial dependencies can be created with relationships', function () {
    Sanctum::actingAs($this->admin);
    $jurisdiccion = Jurisdiccion::factory()->create();
    $competencia = Competencia::factory()->create();

    $response = $this->postJson('/api/dependencias-judiciales', [
        'jurisdiccion_id' => $jurisdiccion->id,
        'competencia_id' => $competencia->id,
        'nombre_juzgado' => 'Juzgado de Prueba',
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.nombre_juzgado', 'Juzgado de Prueba');
});

test('federal business rule: federal radicacion requires federal jurisdiction', function () {
    Sanctum::actingAs($this->admin);
    $caseType = CaseType::factory()->create();

    $competencia = Competencia::factory()->create();
    $federalJurisdiccion = Jurisdiccion::where('nombre', 'Federal')->firstOrFail();
    $federalRadicacion = Radicacion::where('tipo', 'Federal')->firstOrFail();

    // Test case: Federal Radicacion, NON-Federal Jurisdiction
    $otherJurisdiccion = Jurisdiccion::factory()->create(['nombre' => 'Provincial']);
    $dependencia = DependenciaJudicial::create([
        'jurisdiccion_id' => $otherJurisdiccion->id,
        'competencia_id' => $competencia->id,
        'nombre_juzgado' => 'Non-Federal Court',
    ]);

    $response = $this->postJson('/api/cases', [
        'title' => 'Federal Case Fail',
        'case_type_id' => $caseType->id,
        'start_date' => now()->format('Y-m-d'),
        'nro_expediente' => '123/2026',
        'radicacion_id' => $federalRadicacion->id,
        'dependencia_id' => $dependencia->id,
    ]);

    $response->assertStatus(422);
    $response->assertJsonFragment(['message' => 'Para radicaciones Federales, la dependencia debe pertenecer a la jurisdicción Federal.']);

    // Test case: Federal Radicacion, Federal Jurisdiction
    $federalDependencia = DependenciaJudicial::create([
        'jurisdiccion_id' => $federalJurisdiccion->id,
        'competencia_id' => $competencia->id,
        'nombre_juzgado' => 'Federal Court',
    ]);

    $response = $this->postJson('/api/cases', [
        'title' => 'Federal Case Success',
        'case_type_id' => $caseType->id,
        'start_date' => now()->format('Y-m-d'),
        'nro_expediente' => '456/2026',
        'radicacion_id' => $federalRadicacion->id,
        'dependencia_id' => $federalDependencia->id,
    ]);

    $response->assertStatus(201);
});

test('last-modified endpoints work', function () {
    Sanctum::actingAs($this->user);
    $response = $this->getJson('/api/jurisdicciones/last-modified');
    $response->assertStatus(200);
    $response->assertJsonStructure(['last_modified']);
});

test('sync-down endpoints work', function () {
    Sanctum::actingAs($this->user);
    $date = now()->subDay()->format('Y-m-d H:i:s');
    $response = $this->getJson("/api/jurisdicciones/sync?since={$date}");
    $response->assertStatus(200);
    $response->assertJsonStructure(['data']);
});
