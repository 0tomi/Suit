<?php

use App\Models\Client;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('hypothesis 1: invalid date format throws 500 instead of 400/422', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $response = $this->actingAs($user)->getJson("/api/cases/{$case->id}/syncDown/not-a-valid-date");

    // Now it should return 400 Bad Request
    $response->assertStatus(400);
});

test('hypothesis 2: attaching an older client to a case does not sync it down because pivot timestamp is ignored', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    // Create a client 10 days ago
    $pastDate = Carbon::now()->subDays(10);
    $client = Client::factory()->create();
    $client->forceFill(['updated_at' => $pastDate, 'created_at' => $pastDate])->saveQuietly();

    // Now, simulate the user requesting syncDown from 5 days ago
    $syncDate = Carbon::now()->subDays(5)->format('Y-m-d H:i:s');

    // Attach the client TODAY
    $case->clients()->attach($client->id);

    $response = $this->actingAs($user)->getJson("/api/cases/{$case->id}/syncDown/{$syncDate}");

    $response->assertOk();
    $json = $response->json();

    // The client should be synced down because the relation was created today,
    // thanks to the case_client.updated_at timestamp being inspected.
    expect($json['clientes'])->toHaveCount(1);
    expect($json['clientes'][0]['id'])->toBe($client->id);
});

test('hypothesis 3: case last modified ignores pivot timestamp updates', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    // Create a client 10 days ago
    $pastDate = Carbon::now()->subDays(10);
    $client = Client::factory()->create();
    $client->forceFill(['updated_at' => $pastDate, 'created_at' => $pastDate])->saveQuietly();

    // Attach the client TODAY
    $case->clients()->attach($client->id);

    // The case's client relations max last modified should be TODAY (pivot), but it will be 10 days ago.
    $response = $this->actingAs($user)->getJson("/api/cases/{$case->id}/last-modified");

    $response->assertOk();

    $json = $response->json();
    $returnedClientDate = Carbon::parse($json['clientes']);
    expect($returnedClientDate->greaterThanOrEqualTo(Carbon::now()->startOfDay()))->toBeTrue();
});
