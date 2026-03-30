<?php

use App\Models\Gasto;
use App\Models\GastoSuitCase;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->admin->id, 'nro_expediente' => 'EXP-001']);
    $this->gastoType = Gasto::create(['titulo' => 'Sellados', 'detalles' => 'Gasto judicial']);
});

test('admin puede obtener estadisticas de gastos por rango de fechas', function () {
    actingAs($this->admin);

    // Gasto en Enero 2024
    Carbon::setTestNow('2024-01-15 12:00:00');
    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gastoType->id,
        'monto' => 100,
        'user_id' => $this->lawyer->id,
    ]);

    // Gasto en Febrero 2024
    Carbon::setTestNow('2024-02-10 12:00:00');
    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gastoType->id,
        'monto' => 200,
        'user_id' => $this->admin->id,
    ]);

    Carbon::setTestNow(); // Reset

    $response = $this->getJson('/api/gasto-suit-cases/stats?from=2024-01-01&to=2024-12-31')
        ->assertOk()
        ->assertJsonCount(2);

    $response->assertJsonFragment([
        'month' => '2024-01',
        'count' => 1,
        'total_amount' => 100,
    ]);

    $response->assertJsonFragment([
        'month' => '2024-02',
        'count' => 1,
        'total_amount' => 200,
    ]);
});

test('lawyer solo ve sus propias estadisticas', function () {
    // Gasto del lawyer
    Carbon::setTestNow('2024-01-15 12:00:00');
    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gastoType->id,
        'monto' => 100,
        'user_id' => $this->lawyer->id,
    ]);

    // Gasto de otro user (admin)
    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gastoType->id,
        'monto' => 500,
        'user_id' => $this->admin->id,
    ]);

    Carbon::setTestNow();

    actingAs($this->lawyer);

    $response = $this->getJson('/api/gasto-suit-cases/stats?from=2024-01-01&to=2024-12-31')
        ->assertOk()
        ->assertJsonCount(1);

    $response->assertJsonFragment([
        'month' => '2024-01',
        'count' => 1,
        'total_amount' => 100,
    ]);
});

test('admin puede filtrar estadisticas por user_id', function () {
    Carbon::setTestNow('2024-01-15 12:00:00');

    // Gasto del lawyer
    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gastoType->id,
        'monto' => 100,
        'user_id' => $this->lawyer->id,
    ]);

    // Gasto del admin
    GastoSuitCase::create([
        'suit_case_id' => $this->case->id,
        'gasto_id' => $this->gastoType->id,
        'monto' => 500,
        'user_id' => $this->admin->id,
    ]);

    Carbon::setTestNow();

    actingAs($this->admin);

    // Filtrar por lawyer
    $response = $this->getJson("/api/gasto-suit-cases/stats?from=2024-01-01&to=2024-12-31&user_id={$this->lawyer->id}")
        ->assertOk()
        ->assertJsonCount(1);

    $response->assertJsonFragment([
        'month' => '2024-01',
        'count' => 1,
        'total_amount' => 100,
    ]);
});
