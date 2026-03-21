<?php

use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
});

test('usuario autenticado puede listar roles', function () {
    actingAs($this->lawyer);

    Rol::factory()->count(3)->create();

    $this->getJson('/api/roles')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('usuario no autenticado recibe 401', function () {
    $this->getJson('/api/roles')
        ->assertUnauthorized();
});

test('lawyer puede crear un rol', function () {
    actingAs($this->lawyer);

    $this->postJson('/api/roles', ['titulo' => 'Mediador'])
        ->assertCreated()
        ->assertJsonPath('data.titulo', 'Mediador');

    $this->assertDatabaseHas('roles', ['titulo' => 'Mediador']);
});

test('admin puede crear un rol', function () {
    actingAs($this->admin);

    $this->postJson('/api/roles', ['titulo' => 'Árbitro'])
        ->assertCreated();
});

test('falla al crear rol sin titulo', function () {
    actingAs($this->admin);

    $this->postJson('/api/roles', [])
        ->assertUnprocessable();
});

test('admin puede actualizar un rol', function () {
    actingAs($this->admin);

    $rol = Rol::factory()->create(['titulo' => 'Original']);

    $this->putJson("/api/roles/{$rol->id}", ['titulo' => 'Actualizado'])
        ->assertOk()
        ->assertJsonPath('data.titulo', 'Actualizado');
});

test('admin puede eliminar un rol', function () {
    actingAs($this->admin);

    $rol = Rol::factory()->create();

    $this->deleteJson("/api/roles/{$rol->id}")
        ->assertNoContent();

    $this->assertSoftDeleted('roles', ['id' => $rol->id]);
});
