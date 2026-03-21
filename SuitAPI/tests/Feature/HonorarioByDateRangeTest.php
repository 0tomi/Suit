<?php

use App\Models\Client;
use App\Models\Honorario;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->admin->id, 'nro_expediente' => 'EXP-001']);
    $this->client = Client::factory()->create();
    $this->case->clients()->attach($this->client->id);
});

test('admin puede obtener todos los honorarios por rango de fechas', function () {
    $lawyer2 = User::factory()->create(['role' => 'lawyer']);

    Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->lawyer->id,
        'monto' => 1000,
        'detalles' => 'Honorarios lawyer',
    ]);

    Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $lawyer2->id,
        'monto' => 2000,
        'detalles' => 'Honorarios lawyer2',
    ]);

    actingAs($this->admin);

    $this->getJson('/api/honorarios/by-date-range?from=2020-01-01&to=2099-12-31')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('lawyer solo ve sus propios honorarios en el rango de fechas', function () {
    $lawyer2 = User::factory()->create(['role' => 'lawyer']);

    Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->lawyer->id,
        'monto' => 1000,
        'detalles' => 'Honorarios lawyer',
    ]);

    Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $lawyer2->id,
        'monto' => 2000,
        'detalles' => 'Honorarios lawyer2',
    ]);

    actingAs($this->lawyer);

    $this->getJson('/api/honorarios/by-date-range?from=2020-01-01&to=2099-12-31')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('falla la validacion sin los parametros requeridos', function () {
    actingAs($this->admin);

    $this->getJson('/api/honorarios/by-date-range')
        ->assertUnprocessable();
});

test('retorna coleccion vacia cuando no hay honorarios en el rango', function () {
    actingAs($this->admin);

    $this->getJson('/api/honorarios/by-date-range?from=2000-01-01&to=2000-12-31')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
