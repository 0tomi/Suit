<?php

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\EventType;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeUser(string $role = 'lawyer'): User
{
    return User::factory()->create(['role' => $role]);
}

function makeAgendaForUser(User $user): Agenda
{
    return Agenda::factory()->create(['name' => 'Test Agenda', 'user_id' => $user->id]);
}

function makeEvent(Agenda $agenda, ?SuitCase $case = null): Event
{
    return Event::factory()->create([
        'agenda_id' => $agenda->id,
        'title' => 'Test Event',
        'starts_at' => now()->toDateTimeString(),
        'suit_case_id' => $case?->id,
    ]);
}

function makeDeadline(Event $event, array $overrides = []): Deadline
{
    return Deadline::factory()->create(array_merge([
        'event_id' => $event->id,
        'title' => 'Test Deadline',
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'priority' => 'Normal',
        'status' => 'Pendiente',
    ], $overrides));
}

// ─── STORE ──────────────────────────────────────────────────────────────────

test('user can create a deadline with an explicit event_id', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);

    $response = $this->actingAs($user)->postJson('/api/vencimientos', [
        'event_id' => $event->id,
        'title' => 'Deadline Test',
        'description' => 'Some description',
        'due_date' => now()->addDays(10)->format('Y-m-d'),
    ]);

    $response->assertCreated();
    $response->assertJsonFragment(['title' => 'Deadline Test']);
    $this->assertDatabaseHas('deadlines', ['event_id' => $event->id, 'title' => 'Deadline Test']);
});

test('user can create a deadline with a notify_at date', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $notifyDate = now()->addDays(5)->format('Y-m-d H:i:s');

    $response = $this->actingAs($user)->postJson('/api/vencimientos', [
        'event_id' => $event->id,
        'title' => 'Deadline Notification Test',
        'due_date' => now()->addDays(10)->format('Y-m-d'),
        'notify_at' => $notifyDate,
    ]);

    $response->assertCreated();
    $response->assertJsonFragment(['notify_at' => \Illuminate\Support\Carbon::parse($notifyDate)->toJSON()]);

    $this->assertDatabaseHas('event_notifications', [
        'event_id' => $event->id,
        'user_id' => $user->id,
        'notify_at' => \Illuminate\Support\Carbon::parse($notifyDate)->format('Y-m-d H:i:s'),
    ]);
});

test('creating a deadline without event_id auto-creates an event in personal agenda', function () {
    EventType::firstOrCreate(['name' => 'Vencimiento'], ['color' => null]);
    $user = makeUser();
    makeAgendaForUser($user);

    $response = $this->actingAs($user)->postJson('/api/vencimientos', [
        'title' => 'Auto Event Deadline',
        'due_date' => now()->addDays(5)->format('Y-m-d'),
    ]);

    $response->assertCreated();
    $deadline = Deadline::first();
    expect($deadline->title)->toBe('Auto Event Deadline');

    $event = Event::find($deadline->event_id);
    expect($event)->not->toBeNull();
    expect($event->title)->toBe('Auto Event Deadline');
    expect($event->is_all_day)->toBe(true);
});

test('creating a deadline with suit_case_id uses the case agenda', function () {
    EventType::firstOrCreate(['name' => 'Vencimiento'], ['color' => null]);
    $user = makeUser();
    makeAgendaForUser($user);

    $case = SuitCase::factory()->create([
        'title' => 'My Case',
        'lawyer_id' => $user->id,
        'start_date' => now(),
    ]);
    $caseAgenda = Agenda::create([
        'name' => 'Case Agenda',
        'user_id' => $user->id,
        'suit_case_id' => $case->id,
    ]);

    $response = $this->actingAs($user)->postJson('/api/vencimientos', [
        'suit_case_id' => $case->id,
        'title' => 'Case Deadline',
        'due_date' => now()->addDays(15)->format('Y-m-d'),
    ]);

    $response->assertCreated();
    $deadline = Deadline::first();
    $event = Event::find($deadline->event_id);
    expect($event->agenda_id)->toBe($caseAgenda->id);
    expect($event->suit_case_id)->toBe($case->id);
});

// ─── SHOW / INFERENCIA ──────────────────────────────────────────────────────

test('pending deadline is returned as Pendiente before due_date', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, ['due_date' => now()->addDays(10)->format('Y-m-d')]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['status' => 'Pendiente']);
});

test('deadline within 2 days is inferred as Urgente priority', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, ['due_date' => now()->addDay()->format('Y-m-d')]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['priority' => 'Urgente']);
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'priority' => 'Urgente']);
});

test('overdue pending deadline is inferred as Vencido', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, [
        'due_date' => now()->subDays(2)->format('Y-m-d'),
        'status' => 'Pendiente',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['status' => 'Vencido']);
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'status' => 'Vencido']);
});

test('Cumplido deadline is never changed by inference', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, [
        'due_date' => now()->subDays(5)->format('Y-m-d'),
        'status' => 'Cumplido',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['status' => 'Cumplido']);
});

test('Prorrogado deadline that passed is inferred as Vencido', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Prorrogado',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['status' => 'Vencido']);
});

// ─── COMPLETAR ───────────────────────────────────────────────────────────────

test('user can mark a deadline as Cumplido via POST completar', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event);

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/completar");

    $response->assertOk()->assertJsonFragment(['status' => 'Cumplido']);
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'status' => 'Cumplido']);
});

// ─── PRORROGAR ───────────────────────────────────────────────────────────────

test('user can prorrogar an overdue deadline', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, [
        'due_date' => now()->subDays(3)->format('Y-m-d'),
        'status' => 'Vencido',
    ]);

    $newDate = now()->addDays(30)->format('Y-m-d');

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => $newDate,
    ]);

    $response->assertOk()->assertJsonFragment(['status' => 'Prorrogado', 'due_date' => $newDate]);
    $this->assertDatabaseHas('deadlines', ['id' => $deadline->id, 'status' => 'Prorrogado', 'due_date' => $newDate.' 00:00:00']);
});

test('prorrogar fails if deadline is not Vencido', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event); // Pendiente

    $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => now()->addDays(10)->format('Y-m-d'),
    ])->assertUnprocessable();
});

test('prorrogar requires a future date', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, ['status' => 'Vencido', 'due_date' => now()->subDay()->format('Y-m-d')]);

    $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => now()->subDay()->format('Y-m-d'),
    ])->assertUnprocessable();
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

test('user can update deadline priority and description', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event);

    $response = $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'priority' => 'Urgente',
        'description' => 'Updated description',
    ]);

    $response->assertOk()->assertJsonFragment(['priority' => 'Urgente', 'description' => 'Updated description']);
});

test('user can attach a notify_at date to a deadline', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event);
    $notifyDate = now()->addDays(2)->format('Y-m-d H:i:s');

    $response = $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'notify_at' => $notifyDate,
    ]);

    $response->assertOk()->assertJsonFragment(['notify_at' => \Illuminate\Support\Carbon::parse($notifyDate)->toJSON()]);

    $this->assertDatabaseHas('event_notifications', [
        'event_id' => $event->id,
        'user_id' => $user->id,
        'notify_at' => \Illuminate\Support\Carbon::parse($notifyDate)->format('Y-m-d H:i:s'),
    ]);
});

test('user can remove a notify_at date from a deadline by passing null', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event);

    // First, let's attach a notification manually
    \App\Models\EventNotification::create([
        'event_id' => $event->id,
        'user_id' => $user->id,
        'notify_at' => now()->addDays(2),
    ]);

    $response = $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'notify_at' => null,
    ]);

    $response->assertOk()->assertJsonFragment(['notify_at' => null]);

    $this->assertDatabaseMissing('event_notifications', [
        'event_id' => $event->id,
        'user_id' => $user->id,
    ]);
});

// ─── DESTROY / TOMBSTONE ────────────────────────────────────────────────────

test('deleting a deadline creates a tombstone entry', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event);
    $deadlineId = $deadline->id;

    $this->actingAs($user)->deleteJson("/api/vencimientos/{$deadlineId}")->assertNoContent();

    $this->assertDatabaseMissing('deadlines', ['id' => $deadlineId]);
    $this->assertDatabaseHas('tombstones', ['resource_type' => 'deadline', 'resource_id' => $deadlineId]);
});

// ─── INDEX (listado por mes/año) ─────────────────────────────────────────────

test('index returns deadlines for the given month and year', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);

    $targetDate = Carbon::create(2027, 6, 15);
    $otherDate = Carbon::create(2027, 7, 5);

    makeDeadline($event, ['title' => 'Junio Deadline', 'due_date' => $targetDate->format('Y-m-d')]);
    makeDeadline($event, ['title' => 'Julio Deadline', 'due_date' => $otherDate->format('Y-m-d')]);

    $response = $this->actingAs($user)->getJson('/api/vencimientos/6/2027');

    $response->assertOk()
        ->assertJsonFragment(['title' => 'Junio Deadline'])
        ->assertJsonMissing(['title' => 'Julio Deadline']);
});

test('index does not return deadlines from inaccessible agendas', function () {
    $user = makeUser();
    $other = makeUser();

    $myAgenda = makeAgendaForUser($user);
    $otherAgenda = makeAgendaForUser($other);

    $myEvent = makeEvent($myAgenda);
    $otherEvent = makeEvent($otherAgenda);

    $targetDate = Carbon::create(2027, 6, 15);

    makeDeadline($myEvent, ['title' => 'Mine', 'due_date' => $targetDate->format('Y-m-d')]);
    makeDeadline($otherEvent, ['title' => 'Not Mine', 'due_date' => $targetDate->format('Y-m-d')]);

    $response = $this->actingAs($user)->getJson('/api/vencimientos/6/2027');

    $response->assertOk()
        ->assertJsonFragment(['title' => 'Mine'])
        ->assertJsonMissing(['title' => 'Not Mine']);
});

// ─── LAST-MODIFIED ───────────────────────────────────────────────────────────

test('deadlines last-modified returns the max updated_at for the given month', function () {
    Carbon::setTestNow(Carbon::create(2027, 6, 10, 12, 0, 0));

    $user = makeUser();
    $agenda = makeAgendaForUser($user);
    $event = makeEvent($agenda);

    $older = makeDeadline($event, ['due_date' => '2027-06-15']);
    $older->updated_at = now()->subDays(5);
    $older->saveQuietly();

    $newer = makeDeadline($event, ['due_date' => '2027-06-20']);
    $newer->updated_at = now()->subDay();
    $newer->saveQuietly();

    $response = $this->actingAs($user)->getJson('/api/vencimientos/last-modified/6/2027');

    $response->assertOk()
        ->assertJson(['last_modified' => $newer->updated_at->format('Y-m-d H:i:s')]);

    Carbon::setTestNow();
});

// ─── POLICY ───────────────────────────────────────────────────────────────────

test('user cannot view a deadline from another user agenda', function () {
    $owner = makeUser();
    $other = makeUser();

    $agenda = makeAgendaForUser($owner);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event);

    $this->actingAs($other)
        ->getJson("/api/vencimientos/{$deadline->id}")
        ->assertForbidden();
});

test('admin can view any deadline', function () {
    $admin = makeUser('admin');
    $owner = makeUser();

    $agenda = makeAgendaForUser($owner);
    $event = makeEvent($agenda);
    $deadline = makeDeadline($event, ['title' => 'Admin Visible']);

    $this->actingAs($admin)
        ->getJson("/api/vencimientos/{$deadline->id}")
        ->assertOk()
        ->assertJsonFragment(['title' => 'Admin Visible']);
});

// ─── AGENDAS: allEventsByType / allVencimientos ───────────────────────────────

test('allEvents can be filtered by event type', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);

    $vencType = EventType::firstOrCreate(['name' => 'Vencimiento'], ['color' => null]);
    $otherType = EventType::firstOrCreate(['name' => 'Otro'], ['color' => null]);

    Event::create(['agenda_id' => $agenda->id, 'title' => 'Venc Event', 'starts_at' => '2027-06-10 10:00:00', 'event_type_id' => $vencType->id]);
    Event::create(['agenda_id' => $agenda->id, 'title' => 'Other Event', 'starts_at' => '2027-06-10 10:00:00', 'event_type_id' => $otherType->id]);

    $response = $this->actingAs($user)->getJson("/api/agendas/all-events/type/{$vencType->id}/6/2027");

    $response->assertOk()
        ->assertJsonFragment(['title' => 'Venc Event'])
        ->assertJsonMissing(['title' => 'Other Event']);
});

test('allVencimientos shortcut returns only Vencimiento events', function () {
    $user = makeUser();
    $agenda = makeAgendaForUser($user);

    EventType::firstOrCreate(['name' => 'Vencimiento'], ['color' => null]);
    EventType::firstOrCreate(['name' => 'Otro'], ['color' => null]);

    $vencType = EventType::where('name', 'Vencimiento')->first();
    $otherType = EventType::where('name', 'Otro')->first();

    Event::create(['agenda_id' => $agenda->id, 'title' => 'Venc Event 2', 'starts_at' => '2027-06-10 10:00:00', 'event_type_id' => $vencType->id]);
    Event::create(['agenda_id' => $agenda->id, 'title' => 'Not Venc', 'starts_at' => '2027-06-10 10:00:00', 'event_type_id' => $otherType->id]);

    $response = $this->actingAs($user)->getJson('/api/agendas/all-events/vencimientos/6/2027');

    $response->assertOk()
        ->assertJsonFragment(['title' => 'Venc Event 2'])
        ->assertJsonMissing(['title' => 'Not Venc']);
});
