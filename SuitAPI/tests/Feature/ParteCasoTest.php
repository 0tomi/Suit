<?php

use App\Models\Parte;
use App\Models\Rol;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->lawyer->id, 'nro_expediente' => 'EXP-001']);
    $this->rol = Rol::factory()->create(['titulo' => 'Juez']);
    $this->parte = Parte::factory()->create(['rol_id' => $this->rol->id]);
});

test('puede listar partes de un caso vacio', function () {
    actingAs($this->lawyer);

    $this->getJson("/api/suit-cases/{$this->case->id}/partes")
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('puede asociar una parte a un caso', function () {
    actingAs($this->lawyer);

    $this->postJson("/api/suit-cases/{$this->case->id}/partes", [
        'parte_id' => $this->parte->id,
    ])->assertOk()
        ->assertJsonPath('data.id', $this->parte->id);

    $this->assertDatabaseHas('parte_caso', [
        'suit_case_id' => $this->case->id,
        'parte_id' => $this->parte->id,
    ]);
});

test('asociar la misma parte dos veces es idempotente', function () {
    actingAs($this->lawyer);

    $this->postJson("/api/suit-cases/{$this->case->id}/partes", ['parte_id' => $this->parte->id]);
    $this->postJson("/api/suit-cases/{$this->case->id}/partes", ['parte_id' => $this->parte->id])
        ->assertOk();

    $this->assertDatabaseCount('parte_caso', 1);
});

test('puede desasociar una parte de un caso', function () {
    actingAs($this->lawyer);

    $this->case->partes()->attach($this->parte->id);

    $this->deleteJson("/api/suit-cases/{$this->case->id}/partes/{$this->parte->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('parte_caso', [
        'suit_case_id' => $this->case->id,
        'parte_id' => $this->parte->id,
    ]);
});

test('usuario sin acceso al caso no puede listar sus partes', function () {
    $unauthorized = User::factory()->create(['role' => 'lawyer']);
    actingAs($unauthorized);

    $this->getJson("/api/suit-cases/{$this->case->id}/partes")
        ->assertForbidden();
});

// H1: exists:partes,id no filtra soft-deleted — una parte eliminada no debería poder asociarse
test('no se puede asociar una parte soft-deleted a un caso', function () {
    actingAs($this->lawyer);

    $this->parte->delete();

    $this->postJson("/api/suit-cases/{$this->case->id}/partes", [
        'parte_id' => $this->parte->id,
    ])->assertUnprocessable();
});

// H2: La parte soft-deleted no debe aparecer en el listado aunque el pivot exista
test('parte soft-deleted no aparece en el listado del caso', function () {
    actingAs($this->lawyer);

    $this->case->partes()->attach($this->parte->id);
    $this->parte->delete();

    $this->getJson("/api/suit-cases/{$this->case->id}/partes")
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

// H3: Desasociar una parte que no está en el caso devuelve 204 sin error
test('desasociar una parte no asociada al caso retorna 204 sin errores', function () {
    actingAs($this->lawyer);

    $this->deleteJson("/api/suit-cases/{$this->case->id}/partes/{$this->parte->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('parte_caso', [
        'suit_case_id' => $this->case->id,
        'parte_id' => $this->parte->id,
    ]);
});

// H4: Al restaurar una parte soft-deleted, reaparece en los casos que tenía asociados via pivot
test('restaurar una parte soft-deleted la hace reaparecer en sus casos asociados', function () {
    actingAs($this->lawyer);

    $this->case->partes()->attach($this->parte->id);
    $this->parte->delete();

    // Con parte eliminada: no aparece
    $this->getJson("/api/suit-cases/{$this->case->id}/partes")
        ->assertOk()
        ->assertJsonCount(0, 'data');

    // Restauramos la parte
    $this->parte->restore();

    // Con parte restaurada: reaparece en el caso (el pivot nunca se borró)
    $this->getJson("/api/suit-cases/{$this->case->id}/partes")
        ->assertOk()
        ->assertJsonCount(1, 'data');
});
