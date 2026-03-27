<?php

use App\Models\PlantillaRequisito;
use App\Models\Requisito;
use App\Models\Template;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    actingAs($this->user);
});

test('can list requisitos', function () {
    Requisito::factory()->count(3)->create();

    getJson('/api/requisitos')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can create a requisito', function () {
    $data = [
        'type' => 'caseType',
        'title' => 'Tipo de Caso',
    ];

    postJson('/api/requisitos', $data)
        ->assertCreated()
        ->assertJsonFragment(['title' => 'Tipo de Caso']);

    $this->assertDatabaseHas('requisitos', ['title' => 'Tipo de Caso']);
});

test('can show a requisito', function () {
    $requisito = Requisito::factory()->create();

    getJson("/api/requisitos/{$requisito->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $requisito->id);
});

test('can update a requisito', function () {
    $requisito = Requisito::factory()->create();

    putJson("/api/requisitos/{$requisito->id}", ['title' => 'Nuevo Titulo', 'type' => 'date'])
        ->assertOk()
        ->assertJsonFragment(['title' => 'Nuevo Titulo']);

    $this->assertDatabaseHas('requisitos', ['id' => $requisito->id, 'title' => 'Nuevo Titulo']);
});

test('can delete a requisito', function () {
    $requisito = Requisito::factory()->create();

    deleteJson("/api/requisitos/{$requisito->id}")
        ->assertNoContent();

    $this->assertSoftDeleted('requisitos', ['id' => $requisito->id]);
    $this->assertDatabaseHas('tombstones', ['resource_type' => 'requisito', 'resource_id' => $requisito->id]);
});

test('can get last modified for requisitos', function () {
    $date = now()->subDays(1)->startOfSecond();
    Requisito::factory()->create(['updated_at' => $date]);

    getJson('/api/requisitos/last-modified')
        ->assertOk()
        ->assertJsonPath('last_modified', $date->toISOString());
});

test('can sync down requisitos', function () {
    $oldReq = Requisito::factory()->create(['updated_at' => now()->subDays(2)]);
    $newReq = Requisito::factory()->create(['updated_at' => now()]);

    getJson('/api/requisitos/sync?since='.now()->subDay()->toDateTimeString())
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $newReq->id);
});

test('template show includes requirements', function () {
    $template = Template::factory()->create();
    $requisito = Requisito::factory()->create(['title' => 'Req 1']);

    PlantillaRequisito::create([
        'template_id' => $template->id,
        'requisito_id' => $requisito->id,
        'id_campo' => 'campo_1',
    ]);

    getJson("/api/templates/{$template->id}")
        ->assertOk()
        ->assertJsonFragment(['id_campo' => 'campo_1', 'requisito_id' => $requisito->id, 'title' => 'Req 1']);
});

test('can get template requirements last modified', function () {
    $template = Template::factory()->create();
    $date = now()->subDays(1)->startOfSecond();

    $requisito = Requisito::factory()->create();
    PlantillaRequisito::create([
        'template_id' => $template->id,
        'requisito_id' => $requisito->id,
        'id_campo' => 'campo_test',
    ]);

    \Illuminate\Support\Facades\DB::table('plantilla_requisitos')
        ->where('template_id', $template->id)
        ->update(['updated_at' => $date]);

    getJson("/api/templates/{$template->id}/requirements/last-modified")
        ->assertOk()
        ->assertJsonPath('last_modified', $date->toISOString());
});
