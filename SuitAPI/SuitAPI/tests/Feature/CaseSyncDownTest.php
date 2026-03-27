<?php

use App\Models\Client;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('caseSyncDown returns modified relations since the given date', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $client1 = Client::factory()->create();
    $case->clients()->attach($client1->id);

    // Manipulate timestamps to be past
    $pastDate = Carbon::now()->subDays(5);
    \Illuminate\Support\Facades\DB::table('case_client')->where('client_id', $client1->id)->update(['updated_at' => $pastDate]);
    $client1->forceFill(['updated_at' => $pastDate])->saveQuietly();

    // Add a new client after the sync date
    $client2 = Client::factory()->create();
    $case->clients()->attach($client2->id);

    $syncDate = Carbon::now()->subDays(2)->format('Y-m-d H:i:s');

    $response = $this->actingAs($user)->getJson("/api/cases/{$case->id}/syncDown/{$syncDate}");

    $response->assertOk();
    $json = $response->json();

    expect($json)->toHaveKeys(['partes', 'gastos', 'honorarios', 'documentos', 'eventos', 'clientes', 'multimedia', 'archivos']);

    // Only client2 should be in the clients array because it was created after $syncDate
    expect($json['clientes'])->toHaveCount(1);
    expect($json['clientes'][0]['id'])->toBe($client2->id);
    expect($json['gastos'])->toBeEmpty();
});

test('caseSyncDown restricts access for unauthorized users', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);

    $otherUser = User::factory()->create(['role' => 'lawyer']);

    $syncDate = Carbon::now()->subDays(2)->format('Y-m-d H:i:s');

    $response = $this->actingAs($otherUser)->getJson("/api/cases/{$case->id}/syncDown/{$syncDate}");

    $response->assertForbidden();
});
