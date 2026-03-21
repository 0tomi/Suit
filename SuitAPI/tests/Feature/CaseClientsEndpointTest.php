<?php

use App\Models\Client;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;

/** @var \Tests\TestCase $this */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    actingAs($this->user());
});

test('can list clients for a case', function () {
    $case = SuitCase::factory()->create(['lawyer_id' => $this->user()->id]);

    $clients = Client::factory()->count(3)->create();

    // Attach 2 clients
    $case->clients()->attach([$clients[0]->id, $clients[1]->id]);

    getJson("/api/cases/{$case->id}/clients")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['id' => $clients[0]->id])
        ->assertJsonFragment(['id' => $clients[1]->id])
        ->assertJsonMissing(['id' => $clients[2]->id]);
});

test('cannot list clients for a case as unauthorized user', function () {
    $unauthorizedUser = User::factory()->create();
    // The case belongs to another user
    $case = SuitCase::factory()->create();

    actingAs($unauthorizedUser);

    getJson("/api/cases/{$case->id}/clients")
        ->assertForbidden();
});
