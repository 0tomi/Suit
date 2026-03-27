<?php

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'admin']);
    $this->suitCase = SuitCase::factory()->create();

    // Ensure the suitcase has an agenda
    if (! $this->suitCase->agenda) {
        Agenda::factory()->create([
            'suit_case_id' => $this->suitCase->id,
            'user_id' => $this->user->id,
        ]);
    }
});

it('allows creating a deadline with a specific time', function () {
    $dueDateTime = '2026-05-20 15:30:00';

    $response = $this->actingAs($this->user)
        ->postJson('/api/vencimientos', [
            'suit_case_id' => $this->suitCase->id,
            'title' => 'Vencimiento con Hora',
            'due_date' => $dueDateTime,
            'priority' => 'Normal',
        ]);

    $response->assertSuccessful();

    // Verify response format
    $response->assertJsonPath('due_date', $dueDateTime);

    // Verify database storage
    $this->assertDatabaseHas('deadlines', [
        'title' => 'Vencimiento con Hora',
        'due_date' => $dueDateTime,
    ]);
});

it('allows updating a deadline with a specific time', function () {
    $deadline = Deadline::factory()->create([
        'due_date' => '2026-05-20 00:00:00',
    ]);

    $newDateTime = '2026-05-21 09:45:00';

    $response = $this->actingAs($this->user)
        ->putJson("/api/vencimientos/{$deadline->id}", [
            'due_date' => $newDateTime,
        ]);

    $response->assertSuccessful();
    $response->assertJsonPath('due_date', $newDateTime);

    $this->assertDatabaseHas('deadlines', [
        'id' => $deadline->id,
        'due_date' => $newDateTime,
    ]);
});

it('sets is_all_day to false for the implicit event when time is provided', function () {
    $dueDateTime = '2026-05-20 14:00:00';

    $response = $this->actingAs($this->user)
        ->postJson('/api/vencimientos', [
            'suit_case_id' => $this->suitCase->id,
            'title' => 'Vencimiento Evento Check',
            'due_date' => $dueDateTime,
        ]);

    $response->assertSuccessful();

    $deadline = Deadline::where('title', 'Vencimiento Evento Check')->first();
    $event = $deadline->event;

    expect($event->starts_at->toDateTimeString())->toBe($dueDateTime);
    expect($event->is_all_day)->toBeFalse();
});
