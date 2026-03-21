<?php

use App\Models\Client;
use App\Models\Entrega;
use App\Models\Honorario;
use App\Models\SuitCase;
use App\Models\TipoPago;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->admin->id, 'nro_expediente' => 'EXP-001']);
    $this->client = Client::factory()->create();
    $this->case->clients()->attach($this->client->id);
    $this->tipoPago = TipoPago::create(['titulo' => 'Transferencia']);
});

test('nuevo honorario tiene pagado en false por defecto', function () {
    actingAs($this->admin);

    $response = $this->postJson("/api/suit-cases/{$this->case->id}/honorarios", [
        'client_id' => $this->client->id,
        'monto' => 1000,
        'detalles' => 'Honorarios por consulta',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.pagado', false);

    $this->assertDatabaseHas('honorarios', ['pagado' => false]);
});

test('crear una entrega que cubre el monto total marca el honorario como pagado', function () {
    actingAs($this->admin);

    $honorario = Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->admin->id,
        'monto' => 500,
        'detalles' => 'Honorarios',
    ]);

    $this->postJson("/api/honorarios/{$honorario->id}/entregas", [
        'tipo_pago_id' => $this->tipoPago->id,
        'monto' => 500,
        'nota' => null,
    ])->assertCreated();

    $this->assertDatabaseHas('honorarios', ['id' => $honorario->id, 'pagado' => true]);
});

test('crear una entrega parcial no marca el honorario como pagado', function () {
    actingAs($this->admin);

    $honorario = Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->admin->id,
        'monto' => 1000,
        'detalles' => 'Honorarios',
    ]);

    $this->postJson("/api/honorarios/{$honorario->id}/entregas", [
        'tipo_pago_id' => $this->tipoPago->id,
        'monto' => 400,
        'nota' => null,
    ])->assertCreated();

    $this->assertDatabaseHas('honorarios', ['id' => $honorario->id, 'pagado' => false]);
});

test('eliminar una entrega recalcula el estado pagado del honorario', function () {
    actingAs($this->admin);

    $honorario = Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->admin->id,
        'monto' => 300,
        'detalles' => 'Honorarios',
        'pagado' => true,
    ]);

    $entrega = Entrega::create([
        'honorario_id' => $honorario->id,
        'tipo_pago_id' => $this->tipoPago->id,
        'monto' => 300,
    ]);

    $this->deleteJson("/api/entregas/{$entrega->id}")->assertNoContent();

    $this->assertDatabaseHas('honorarios', ['id' => $honorario->id, 'pagado' => false]);
});

// H2: Reducir el monto de una entrega que cubría el total debe revertir pagado a false
test('reducir el monto de una entrega que cubria el total revierte pagado a false', function () {
    actingAs($this->admin);

    $honorario = Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->admin->id,
        'monto' => 500,
        'detalles' => 'Honorarios',
    ]);

    $entrega = Entrega::create([
        'honorario_id' => $honorario->id,
        'tipo_pago_id' => $this->tipoPago->id,
        'monto' => 500,
    ]);

    $honorario->recalcularPagado();
    $this->assertDatabaseHas('honorarios', ['id' => $honorario->id, 'pagado' => true]);

    // Reducir el monto de la entrega por debajo del total
    $this->putJson("/api/entregas/{$entrega->id}", ['monto' => 250])
        ->assertOk();

    $this->assertDatabaseHas('honorarios', ['id' => $honorario->id, 'pagado' => false]);
});

// H2b: Múltiples entregas parciales que juntas cubren el monto marcan el honorario como pagado
test('multiples entregas parciales que suman el total marcan el honorario como pagado', function () {
    actingAs($this->admin);

    $honorario = Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->admin->id,
        'monto' => 900,
        'detalles' => 'Honorarios',
    ]);

    foreach ([300, 300, 300] as $monto) {
        $this->postJson("/api/honorarios/{$honorario->id}/entregas", [
            'tipo_pago_id' => $this->tipoPago->id,
            'monto' => $monto,
            'nota' => null,
        ])->assertCreated();
    }

    $this->assertDatabaseHas('honorarios', ['id' => $honorario->id, 'pagado' => true]);
});

test('el resource de honorario retorna el campo pagado', function () {
    actingAs($this->admin);

    $honorario = Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->admin->id,
        'monto' => 200,
        'detalles' => 'Honorarios',
    ]);

    $this->getJson("/api/honorarios/{$honorario->id}")
        ->assertOk()
        ->assertJsonStructure(['data' => ['pagado', 'total_entregas']]);
});

test('retorna 404 si el honorario no existe al intentar crear una entrega', function () {
    actingAs($this->admin);

    $this->postJson("/api/honorarios/999999/entregas", [
        'tipo_pago_id' => $this->tipoPago->id,
        'monto' => 100,
    ])->assertNotFound();
});
