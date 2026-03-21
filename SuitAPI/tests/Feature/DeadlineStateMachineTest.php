<?php

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ────────────────────────────────────────────────────────────────

function smUser(string $role = 'lawyer'): User
{
    return User::factory()->create(['role' => $role]);
}

function smAgenda(User $user): Agenda
{
    return Agenda::factory()->create(['user_id' => $user->id]);
}

function smEvent(Agenda $agenda): Event
{
    return Event::factory()->create([
        'agenda_id' => $agenda->id,
        'starts_at' => now()->toDateTimeString(),
    ]);
}

function smDeadline(Event $event, array $overrides = []): Deadline
{
    return Deadline::factory()->create(array_merge([
        'event_id' => $event->id,
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'priority' => 'Normal',
        'manually_urgent' => false,
        'status' => 'Pendiente',
    ], $overrides));
}

// ─── Fix 1: Urgente manual no se degrada ─────────────────────────────────────

test('Fix 1: manually urgent deadline is NOT downgraded when more than urgency_days remain', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    // Creado manualmente como Urgente con 10 días de margen
    $deadline = smDeadline($event, [
        'due_date' => now()->addDays(10)->format('Y-m-d'),
        'priority' => 'Urgente',
        'manually_urgent' => true,
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['priority' => 'Urgente']);
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'priority' => 'Urgente']);
});

test('Fix 1: creating a deadline with priority=Urgente stores it as manually urgent', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    $response = $this->actingAs($user)->postJson('/api/vencimientos', [
        'event_id' => $event->id,
        'title' => 'Urgente desde creación',
        'due_date' => now()->addDays(10)->format('Y-m-d'),
        'priority' => 'Urgente',
    ]);

    $response->assertCreated()->assertJsonFragment(['priority' => 'Urgente']);
    $this->assertDatabaseHas('deadlines', [
        'title' => 'Urgente desde creación',
        'priority' => 'Urgente',
        'manually_urgent' => true,
    ]);
});

test('Fix 1: non-manually urgent deadline IS elevated to Urgente when close to due_date', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    $deadline = smDeadline($event, [
        'due_date' => now()->addDay()->format('Y-m-d'),
        'priority' => 'Normal',
        'manually_urgent' => false,
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['priority' => 'Urgente']);
});

test('Fix 1: non-manually urgent deadline far from due_date stays Normal', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    $deadline = smDeadline($event, [
        'due_date' => now()->addDays(15)->format('Y-m-d'),
        'priority' => 'Normal',
        'manually_urgent' => false,
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['priority' => 'Normal']);
});

// ─── Fix 2: Prorrogado no vuelve a Pendiente ─────────────────────────────────

test('Fix 2: Prorrogado deadline does NOT revert to Pendiente on inferState', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    $deadline = smDeadline($event, [
        'due_date' => now()->addDays(15)->format('Y-m-d'),
        'status' => 'Prorrogado',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['status' => 'Prorrogado']);
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'status' => 'Prorrogado']);
});

test('Fix 2: Prorrogado deadline still transitions to Vencido when its date passes', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    $deadline = smDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Prorrogado',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['status' => 'Vencido']);
});

// ─── Fix 1 + Prorrogar: comportamiento de prioridad al prorrogar ──────────────

test('prorrogar without priority resets manually_urgent and re-evaluates priority normally', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    // Vencimiento manualmente urgente, ya vencido
    $deadline = smDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Vencido',
        'priority' => 'Urgente',
        'manually_urgent' => true,
    ]);

    $newDate = now()->addDays(30)->format('Y-m-d');

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => $newDate,
        // No se envía priority → se resetea manually_urgent
    ]);

    $response->assertOk()->assertJsonFragment(['status' => 'Prorrogado', 'priority' => 'Normal']);
    $this->assertDatabaseHas('deadlines', [
        'id' => $deadline->id,
        'manually_urgent' => false,
        'priority' => 'Normal',
    ]);
});

test('prorrogar with priority=Urgente keeps the deadline manually urgent', function () {
    $user = smUser();
    $agenda = smAgenda($user);
    $event = smEvent($agenda);

    $deadline = smDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Vencido',
        'priority' => 'Normal',
        'manually_urgent' => false,
    ]);

    $newDate = now()->addDays(20)->format('Y-m-d');

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => $newDate,
        'priority' => 'Urgente',
    ]);

    $response->assertOk()->assertJsonFragment(['status' => 'Prorrogado', 'priority' => 'Urgente']);
    $this->assertDatabaseHas('deadlines', [
        'id' => $deadline->id,
        'manually_urgent' => true,
        'priority' => 'Urgente',
    ]);
});
