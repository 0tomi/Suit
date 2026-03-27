<?php

use App\Models\Parte;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->rol = Rol::factory()->create(['titulo' => 'Testigo']);
});

test('usuario autenticado puede listar partes', function () {
    actingAs($this->lawyer);

    Parte::factory()->count(2)->create(['rol_id' => $this->rol->id]);

    $this->getJson('/api/partes')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('listar partes incluye el rol cargado', function () {
    actingAs($this->lawyer);

    Parte::factory()->create(['rol_id' => $this->rol->id]);

    $this->getJson('/api/partes')
        ->assertOk()
        ->assertJsonPath('data.0.rol.titulo', 'Testigo');
});

test('lawyer puede crear una parte', function () {
    actingAs($this->lawyer);

    $this->postJson('/api/partes', [
        'nombre' => 'Juan',
        'apellido' => 'Perez',
        'email' => 'juan@example.com',
        'telefono' => '555-1234',
        'rol_id' => $this->rol->id,
    ])->assertCreated()
        ->assertJsonPath('data.nombre', 'Juan')
        ->assertJsonPath('data.rol.titulo', 'Testigo');
});

test('falla al crear parte con rol_id inexistente', function () {
    actingAs($this->admin);

    $this->postJson('/api/partes', [
        'nombre' => 'Ana',
        'apellido' => 'Lopez',
        'rol_id' => 9999,
    ])->assertUnprocessable();
});

test('admin puede actualizar una parte', function () {
    actingAs($this->admin);

    $parte = Parte::factory()->create(['rol_id' => $this->rol->id]);

    $this->putJson("/api/partes/{$parte->id}", ['nombre' => 'NuevoNombre'])
        ->assertOk()
        ->assertJsonPath('data.nombre', 'NuevoNombre');
});

test('admin puede eliminar una parte', function () {
    actingAs($this->admin);

    $parte = Parte::factory()->create(['rol_id' => $this->rol->id]);

    $this->deleteJson("/api/partes/{$parte->id}")
        ->assertNoContent();

    $this->assertSoftDeleted('partes', ['id' => $parte->id]);
});
