<?php

use App\Models\Client;
use App\Models\Document;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertSoftDeleted;
use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    actingAs($this->user);
});

test('can list clients', function () {
    Client::factory()->count(3)->create();

    getJson('/api/clients')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('can search clients', function () {
    Client::factory()->for(\App\Models\Persona::factory()->state(['first_name' => 'John', 'last_name' => 'Doe']))->create();
    Client::factory()->for(\App\Models\Persona::factory()->state(['first_name' => 'Jane', 'last_name' => 'Smith']))->create();

    getJson('/api/clients?search=John')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.first_name', 'John');
});

test('can create a client', function () {
    $data = [
        'first_name' => 'Test',
        'last_name' => 'Client',
        'identification_number' => '12345678',
        'email' => 'test@example.com',
        'type' => 'person',
        'status' => 'active',
        'gender' => 'M',
    ];

    postJson('/api/clients', $data)
        ->assertCreated()
        ->assertJsonFragment($data);

    $this->assertDatabaseHas('personas', ['first_name' => 'Test', 'identification_number' => '12345678']);
});

test('can create client without identification number (nullable)', function () {
    Client::factory()->for(\App\Models\Persona::factory()->state(['identification_number' => null]))->create();

    $data = [
        'first_name' => 'Test',
        'last_name' => 'Client',
        'identification_number' => null,
        'gender' => 'F',
    ];

    postJson('/api/clients', $data)
        ->assertCreated();

    $this->assertDatabaseCount('clients', 2);
});

test('cannot create client with duplicate identification number', function () {
    Client::factory()->for(\App\Models\Persona::factory()->state(['identification_number' => '12345678']))->create();

    $data = [
        'first_name' => 'Another',
        'last_name' => 'Client',
        'identification_number' => '12345678',
        'gender' => 'X',
    ];

    postJson('/api/clients', $data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['identification_number']);
});

test('can update a client', function () {
    $client = Client::factory()->create();

    $data = [
        'first_name' => 'Updated Name',
    ];

    putJson("/api/clients/{$client->id}", $data)
        ->assertOk()
        ->assertJsonFragment($data);

    $this->assertDatabaseHas('personas', ['id' => $client->persona_id, 'first_name' => 'Updated Name']);
});

test('can update client ignoring own unique identification number', function () {
    $client = Client::factory()->for(\App\Models\Persona::factory()->state(['identification_number' => '12345678']))->create();

    putJson("/api/clients/{$client->id}", [
        'identification_number' => '12345678',
        'first_name' => 'Updated',
    ])->assertOk();
});

test('can soft delete a client', function () {
    $client = Client::factory()->create();

    deleteJson("/api/clients/{$client->id}")
        ->assertNoContent();

    assertSoftDeleted($client);
});

test('can attach and detach case', function () {
    $client = Client::factory()->create();
    $case = SuitCase::factory()->create(['lawyer_id' => $this->user->id]);

    // Attach
    postJson("/api/cases/{$case->id}/clients", ['client_ids' => [$client->id]])
        ->assertOk();

    expect($case->clients()->count())->toBe(1);

    // Detach
    deleteJson("/api/cases/{$case->id}/clients/{$client->id}")
        ->assertOk();

    expect($case->clients()->count())->toBe(0);
});

test('can attach and detach document', function () {
    $client = Client::factory()->create();
    $document = Document::factory()->create(['user_id' => $this->user->id]);

    // Attach
    postJson("/api/documents/{$document->id}/clients", ['client_ids' => [$client->id]])
        ->assertOk();

    expect($document->clients()->count())->toBe(1);

    // Detach
    deleteJson("/api/documents/{$document->id}/clients/{$client->id}")
        ->assertOk();

    expect($document->clients()->count())->toBe(0);
});
