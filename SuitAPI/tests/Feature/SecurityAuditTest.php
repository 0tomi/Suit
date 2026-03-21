<?php

use App\Models\User;
use App\Models\SuitCase;
use App\Models\Client;
use App\Models\Honorario;
use App\Models\GastoSuitCase;
use App\Models\Gasto;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('prevents a lawyer from creating an honorario for a case they do not own', function () {
    $lawyerA = User::factory()->create(['role' => 'lawyer']);
    $lawyerB = User::factory()->create(['role' => 'lawyer']);
    
    $caseOfB = SuitCase::factory()->create(['lawyer_id' => $lawyerB->id, 'nro_expediente' => '123']);
    $clientOfB = Client::factory()->create();
    $caseOfB->clients()->attach($clientOfB);

    $response = $this->actingAs($lawyerA)->postJson("/api/suit-cases/{$caseOfB->id}/honorarios", [
        'client_id' => $clientOfB->id,
        'monto' => 1000,
        'detalles' => 'Hack'
    ]);

    $response->assertForbidden();
});

it('requires client specification if the case has multiple clients', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $lawyer->id, 'nro_expediente' => '123']);
    
    $client1 = Client::factory()->create();
    $client2 = Client::factory()->create();
    $case->clients()->attach([$client1->id, $client2->id]);
    
    $gasto = Gasto::create(['titulo' => 'Nafta', 'detalles' => 'Combustible']);

    $response = $this->actingAs($lawyer)->postJson("/api/suit-cases/{$case->id}/gastos", [
        'gasto_id' => $gasto->id,
        'monto' => 500,
    ]);

    $response->assertStatus(422);
});

it('does not permanently detach clients when soft deleting a GastoSuitCase', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $case = SuitCase::factory()->create(['nro_expediente' => '123']);
    $client = Client::factory()->create();
    $case->clients()->attach($client->id);
    
    $gasto = Gasto::create(['titulo' => 'Sellados']);
    
    $gastoCase = GastoSuitCase::create([
        'suit_case_id' => $case->id,
        'gasto_id' => $gasto->id,
        'monto' => 100,
        'user_id' => $admin->id
    ]);
    $gastoCase->clients()->attach($client->id);
    
    expect($gastoCase->clients()->count())->toBe(1);

    $this->actingAs($admin)->deleteJson("/api/gasto-suit-cases/{$gastoCase->id}")->assertSuccessful();

    $this->assertSoftDeleted('gasto_suit_case', ['id' => $gastoCase->id]);
    
    $this->assertDatabaseHas('gasto_cliente', [
        'gasto_suit_case_id' => $gastoCase->id,
        'client_id' => $client->id
    ]);
});
