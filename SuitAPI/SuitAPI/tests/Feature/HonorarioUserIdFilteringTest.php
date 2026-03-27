<?php

use App\Models\Client;
use App\Models\Honorario;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin User']);
    $this->lawyer1 = User::factory()->create(['role' => 'lawyer', 'name' => 'Lawyer 1']);
    $this->lawyer2 = User::factory()->create(['role' => 'lawyer', 'name' => 'Lawyer 2']);

    $this->case = SuitCase::factory()->create(['lawyer_id' => $this->admin->id]);
    $this->client = Client::factory()->create();
    $this->case->clients()->attach($this->client->id);

    // Create honorarios for lawyer 1
    Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->lawyer1->id,
        'monto' => 1000,
        'detalles' => 'Honorario Lawyer 1',
    ]);

    // Create honorarios for lawyer 2
    Honorario::create([
        'suit_case_id' => $this->case->id,
        'client_id' => $this->client->id,
        'user_id' => $this->lawyer2->id,
        'monto' => 2000,
        'detalles' => 'Honorario Lawyer 2',
    ]);
});

test('admin can filter honorarios by user_id in date range', function () {
    actingAs($this->admin);

    // This should fail currently because user_id is ignored and returns both (count 2)
    $this->getJson("/api/honorarios/by-date-range?from=2020-01-01&to=2099-12-31&user_id={$this->lawyer1->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonFragment(['detalles' => 'Honorario Lawyer 1'])
        ->assertJsonMissing(['detalles' => 'Honorario Lawyer 2']);
});

test('admin can filter honorarios by user_id in indexByCase', function () {
    actingAs($this->admin);

    // This should fail currently because user_id is ignored and returns both (count 2)
    $this->getJson("/api/suit-cases/{$this->case->id}/honorarios?user_id={$this->lawyer1->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonFragment(['detalles' => 'Honorario Lawyer 1'])
        ->assertJsonMissing(['detalles' => 'Honorario Lawyer 2']);
});

test('admin can filter honorarios by user_id in indexByClient', function () {
    actingAs($this->admin);

    // This should fail currently because user_id is ignored and returns both (count 2)
    $this->getJson("/api/clients/{$this->client->id}/honorarios?user_id={$this->lawyer1->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonFragment(['detalles' => 'Honorario Lawyer 1'])
        ->assertJsonMissing(['detalles' => 'Honorario Lawyer 2']);
});
