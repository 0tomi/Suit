<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Honorario;
use App\Models\Setting;
use App\Models\SuitCase;
use App\Models\TipoPago;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ClientStatusTest extends TestCase
{
    use RefreshDatabase;

    public ?User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($this->user);

        Setting::set('client_moroso_threshold_days', '30');
    }

    public function test_client_status_becomes_active_when_associated_to_active_case()
    {
        // Client doesn't have active cases yet, should be INACTIVO
        $client = Client::factory()->for(\App\Models\Persona::factory()->state(['status' => Client::STATUS_INACTIVO]))->create();
        $case = SuitCase::factory()->create(['status' => 'active']);

        $this->postJson("/api/cases/{$case->id}/clients", ['client_ids' => [$client->id]])
            ->assertOk();

        $client->refresh();
        $this->assertEquals(Client::STATUS_ACTIVO, $client->persona->status);
    }

    public function test_client_status_becomes_inactive_when_all_cases_are_closed()
    {
        // Client associated to an active case, should be ACTIVO
        $client = Client::factory()->for(\App\Models\Persona::factory()->state(['status' => Client::STATUS_ACTIVO]))->create();
        $case = SuitCase::factory()->create(['lawyer_id' => $this->user->id, 'status' => 'active']);
        $case->clients()->attach($client->id);

        // Verify it's active
        $client->recalculateStatus();
        $this->assertEquals(Client::STATUS_ACTIVO, $client->persona->status);

        // Close the case
        $this->postJson("/api/cases/{$case->id}/close")
            ->assertOk();

        $client->refresh();
        $this->assertEquals(Client::STATUS_INACTIVO, $client->persona->status);
    }

    public function test_client_status_remains_active_if_one_case_is_still_active()
    {
        $this->actingAs($this->user);

        // Client associated to two active cases
        $client = Client::factory()->for(\App\Models\Persona::factory()->state(['status' => Client::STATUS_ACTIVO]))->create();
        $case1 = SuitCase::factory()->create(['status' => 'active']);
        $case2 = SuitCase::factory()->create(['status' => 'active']);

        $case1->clients()->attach($client->id);
        $case2->clients()->attach($client->id);

        $client->recalculateStatus();
        $this->assertEquals(Client::STATUS_ACTIVO, $client->persona->status);

        // Close case 1
        $this->postJson("/api/cases/{$case1->id}/close")
            ->assertOk();

        $client->refresh();
        $this->assertEquals(Client::STATUS_ACTIVO, $client->persona->status);
    }

    public function test_financial_status_becomes_deudor_when_honorario_is_added()
    {
        $client = Client::factory()->create(['financial_status' => Client::FINANCIAL_NO_DEUDOR]);
        $case = SuitCase::factory()->create();
        $case->clients()->attach($client->id);

        $this->postJson("/api/suit-cases/{$case->id}/honorarios", [
            'client_id' => $client->id,
            'monto' => 1000,
            'detalles' => 'Test Fee',
        ])->assertCreated();

        $client->refresh();
        $this->assertEquals(Client::FINANCIAL_DEUDOR, $client->financial_status);
    }

    public function test_financial_status_becomes_no_deudor_when_honorario_is_paid()
    {
        $client = Client::factory()->create();
        $case = SuitCase::factory()->create();
        $case->clients()->attach($client->id);

        $honorario = Honorario::create([
            'suit_case_id' => $case->id,
            'client_id' => $client->id,
            'user_id' => $this->user->id,
            'monto' => 1000,
            'pagado' => false,
        ]);

        $client->recalculateFinancialStatus();
        $this->assertEquals(Client::FINANCIAL_DEUDOR, $client->financial_status);

        $tipoPago = TipoPago::factory()->create();

        // Add payment to cover the fee
        $this->postJson("/api/honorarios/{$honorario->id}/entregas", [
            'monto' => 1000,
            'tipo_pago_id' => $tipoPago->id,
        ])->assertCreated();

        $client->refresh();
        $this->assertEquals(Client::FINANCIAL_NO_DEUDOR, $client->financial_status);
    }

    public function test_financial_status_becomes_moroso_via_sync_command()
    {
        $client = Client::factory()->create();
        $case = SuitCase::factory()->create();
        $case->clients()->attach($client->id);

        // Create an old unpaid honorario (40 days ago to be safe)
        $honorario = Honorario::create([
            'suit_case_id' => $case->id,
            'client_id' => $client->id,
            'user_id' => $this->user->id,
            'monto' => 1000,
            'pagado' => false,
        ]);

        // Force backdate
        $honorario->created_at = now()->subDays(40);
        $honorario->save();

        // Initial status should be moroso (after recalculate)
        $client->recalculateFinancialStatus();
        $this->assertEquals(Client::FINANCIAL_MOROSO, $client->financial_status);

        // Test the sync command
        $client->update(['financial_status' => Client::FINANCIAL_DEUDOR]); // force back
        Artisan::call('clients:sync-status');

        $client->refresh();
        $this->assertEquals(Client::FINANCIAL_MOROSO, $client->financial_status);
    }
}
