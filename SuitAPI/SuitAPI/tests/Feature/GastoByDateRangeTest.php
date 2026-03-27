<?php

use App\Models\Gasto;
use App\Models\GastoSuitCase;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->admin->id, 'nro_expediente' => 'EXP-001']);
    $this->gasto = Gasto::create(['titulo' => 'Sellados', 'detalles' => 'Gasto judicial']);
});

test('admin puede obtener gastos por rango de fechas', function () {
    actingAs($this->admin);

    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gasto->id,
        'monto' => 100,
        'user_id' => $this->admin->id,
    ]);

    $this->getJson('/api/gasto-suit-cases/by-date-range?from=2020-01-01&to=2099-12-31')
        ->assertOk()
        ->assertJsonStructure(['data'])
        ->assertJsonCount(1, 'data');
});

test('lawyer solo ve sus propios gastos en el rango de fechas', function () {
    $lawyer2 = User::factory()->create(['role' => 'lawyer']);
    $case2 = SuitCase::factory()->create(['lawyer_id' => $lawyer2->id, 'nro_expediente' => 'EXP-002']);

    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gasto->id,
        'monto' => 100,
        'user_id' => $this->lawyer->id,
    ]);

    GastoSuitCase::create([
        'suit_case_id' => $case2->id,
        'gasto_id' => $this->gasto->id,
        'monto' => 200,
        'user_id' => $lawyer2->id,
    ]);

    actingAs($this->lawyer);

    $this->getJson('/api/gasto-suit-cases/by-date-range?from=2020-01-01&to=2099-12-31')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('falla la validacion sin el parametro from', function () {
    actingAs($this->admin);

    $this->getJson('/api/gasto-suit-cases/by-date-range?to=2099-12-31')
        ->assertUnprocessable();
});

test('falla la validacion si to es anterior a from', function () {
    actingAs($this->admin);

    $this->getJson('/api/gasto-suit-cases/by-date-range?from=2099-12-31&to=2020-01-01')
        ->assertUnprocessable();
});

test('retorna coleccion vacia cuando no hay gastos en el rango', function () {
    actingAs($this->admin);

    $this->getJson('/api/gasto-suit-cases/by-date-range?from=2000-01-01&to=2000-12-31')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
