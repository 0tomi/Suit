<?php

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeTestUser(string $role = 'lawyer'): User
{
    return User::factory()->create(['role' => $role]);
}

function makeTestAgendaForUser(User $user, ?SuitCase $case = null): Agenda
{
    return Agenda::factory()->create(['name' => 'Test Agenda', 'user_id' => $user->id, 'suit_case_id' => $case?->id]);
}

function makeTestEvent(Agenda $agenda, ?SuitCase $case = null): Event
{
    return Event::factory()->create([
        'agenda_id' => $agenda->id,
        'title' => 'Test Event',
        'starts_at' => now()->toDateTimeString(),
        'suit_case_id' => $case?->id,
    ]);
}

function makeTestDeadline(Event $event, array $overrides = []): Deadline
{
    return Deadline::factory()->create(array_merge([
        'event_id' => $event->id,
        'title' => 'Test Deadline',
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'priority' => 'Normal',
        'status' => 'Pendiente',
    ], $overrides));
}

test('fix: user cannot bypass completar endpoint by using PUT update directly to Cumplido', function () {
    $user = makeTestUser();
    $agenda = makeTestAgendaForUser($user);
    $event = makeTestEvent($agenda);
    $deadline = makeTestDeadline($event);

    $response = $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'status' => 'Cumplido',
    ]);

    // Update is successful but 'status' should be ignored
    $response->assertOk();
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'status' => 'Pendiente']);
});

test('fix: user who downgrades urgency gets it corrected instantly in the PUT response', function () {
    $user = makeTestUser();
    $agenda = makeTestAgendaForUser($user);
    $event = makeTestEvent($agenda);

    // Create an imminent deadline (<= 2 days)
    $deadline = makeTestDeadline($event, ['due_date' => now()->addDay()->format('Y-m-d')]);

    $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}")
        ->assertOk()
        ->assertJsonFragment(['priority' => 'Urgente']);

    // 2) User explicitly updates priority back to Normal
    // But inferState is called during update and instantly corrects it.
    $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'priority' => 'Normal',
    ])->assertOk()->assertJsonFragment(['priority' => 'Urgente']);
});

test('fix: user can fix a mistaken due_date using PUT update', function () {
    $user = makeTestUser();
    $agenda = makeTestAgendaForUser($user);
    $event = makeTestEvent($agenda);
    $deadline = makeTestDeadline($event, ['due_date' => now()->addDays(5)->format('Y-m-d')]);

    $newDate = now()->addDays(10)->format('Y-m-d');

    $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'due_date' => $newDate,
    ])->assertOk();

    $this->assertDatabaseHas('deadlines', [
        'id' => $deadline->id,
        'due_date' => $newDate.' 00:00:00',
    ]);
});

test('fix: user cannot inject event into agenda without update permission on the agenda', function () {
    $owner = makeTestUser();
    $reader = makeTestUser();

    $case = SuitCase::factory()->create(['title' => 'The Case', 'lawyer_id' => $owner->id, 'start_date' => now()]);
    $agenda = makeTestAgendaForUser($owner, $case);

    \Illuminate\Support\Facades\DB::table('case_permissions')->insert([
        'user_id' => $reader->id,
        'suit_case_id' => $case->id,
        'permission_level' => 'participant',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // With our fix, this checks if the reader can update the agenda.
    // They are just 'participant' which likely maps to read, not write.
    // Let's assume AgendaPolicy requires 'permission_level' === 'write'
    $response = $this->actingAs($reader)->postJson('/api/vencimientos', [
        'suit_case_id' => $case->id,
        'due_date' => now()->addDays(5)->format('Y-m-d'),
    ]);

    // Should be explicitly blocked
    $response->assertForbidden();
});
