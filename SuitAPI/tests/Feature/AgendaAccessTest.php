<?php

use App\Models\Agenda;
use App\Models\Event;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('user can view their own agenda', function () {
    $user = User::factory()->create(['role' => 'user']);
    $agenda = Agenda::factory()->create([
        'name' => 'My Agenda',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);

    $response = $this->actingAs($user)->getJson('/api/agendas'); // Changed to index

    $response->assertStatus(200)
        ->assertJsonFragment(['id' => $agenda->id]);
});

test('user cannot see others personal agenda', function () {
    $user1 = User::factory()->create(['role' => 'user']);
    $user2 = User::factory()->create(['role' => 'user']);

    $agenda = Agenda::factory()->create([
        'name' => 'User 1 Agenda',
        'user_id' => $user1->id,
        'suit_case_id' => null,
    ]);

    $response = $this->actingAs($user2)->getJson('/api/agendas');

    $response->assertStatus(200)
        ->assertJsonMissing(['id' => $agenda->id]);
});

test('admin can view all agendas including other users personal agendas', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $other = User::factory()->create(['role' => 'user']);

    $agenda = Agenda::factory()->create([
        'name' => 'Admin Agenda',
        'user_id' => $admin->id,
    ]);
    $otherAgenda = Agenda::create([
        'name' => 'Other User Agenda',
        'user_id' => $other->id,
    ]);

    $response = $this->actingAs($admin)->getJson('/api/agendas');
    $response->assertSuccessful()
        ->assertJsonFragment(['name' => 'Admin Agenda'])
        ->assertJsonFragment(['id' => $otherAgenda->id]);
});

test('supervisor access works via case permissions', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $supervisor = User::factory()->create(['role' => 'lawyer']);

    $case = SuitCase::factory()->create([
        'title' => 'Lawyer Case',
        'lawyer_id' => $lawyer->id,
        'start_date' => now(),
    ]);

    $agenda = Agenda::factory()->create([
        'name' => 'Case Agenda',
        'user_id' => $lawyer->id,
        'suit_case_id' => $case->id,
    ]);

    // Initial check: Supervisor cannot see
    $this->actingAs($supervisor)->getJson('/api/agendas')
        ->assertJsonMissing(['id' => $agenda->id]);

    // Grant permission (add as participant)
    $case->participants()->attach($supervisor->id, ['permission_level' => 'full_access']);

    // Check again: Supervisor can see
    $this->actingAs($supervisor)->getJson('/api/agendas')
        ->assertJsonFragment(['id' => $agenda->id]);
});

test('index returns correct agendas', function () {
    $user = User::factory()->create(['role' => 'user']);
    $other = User::factory()->create(['role' => 'user']);

    Agenda::create(['name' => 'Mine', 'user_id' => $user->id]);
    Agenda::create(['name' => 'Not Mine', 'user_id' => $other->id]);

    $response = $this->actingAs($user)->getJson('/api/agendas');

    $response->assertStatus(200)
        ->assertJsonFragment(['name' => 'Mine'])
        ->assertJsonMissing(['name' => 'Not Mine']);
});

test('all-events returns only current month and next month events', function () {
    Carbon::setTestNow(Carbon::create(2026, 3, 5, 10, 0, 0));
    $user = User::factory()->create(['role' => 'user']);

    $agenda = Agenda::create([
        'name' => 'Personal Agenda',
        'user_id' => $user->id,
    ]);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento mes anterior',
        'starts_at' => now()->subMonth()->startOfMonth()->toDateTimeString(),
    ]);
    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento mes actual',
        'starts_at' => now()->startOfMonth()->toDateTimeString(),
    ]);
    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento mes siguiente',
        'starts_at' => now()->addMonth()->endOfMonth()->toDateTimeString(),
    ]);
    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento fuera de rango',
        'starts_at' => now()->addMonths(2)->startOfMonth()->toDateTimeString(),
    ]);

    $this->actingAs($user)
        ->getJson('/api/agendas/all-events')
        ->assertSuccessful()
        ->assertJsonFragment(['title' => 'Evento mes actual'])
        ->assertJsonFragment(['title' => 'Evento mes siguiente'])
        ->assertJsonMissing(['title' => 'Evento mes anterior'])
        ->assertJsonMissing(['title' => 'Evento fuera de rango']);

    Carbon::setTestNow();
});

test('all-events last-modified returns correct latest timestamp', function () {
    Carbon::setTestNow(Carbon::create(2026, 3, 5, 10, 0, 0));
    $user = User::factory()->create(['role' => 'user']);

    $agenda = Agenda::create([
        'name' => 'Personal Agenda',
        'user_id' => $user->id,
    ]);

    $oldEvent = Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento viejo',
        'starts_at' => now()->toDateTimeString(),
        'updated_at' => now()->subDays(5),
    ]);

    $recentEvent = clone $oldEvent;
    $recentEvent->id = null;
    $recentEvent->title = 'Evento mas reciente';
    $recentEvent->updated_at = now()->subDays(2);
    $recentEvent = Event::create(array_merge($recentEvent->toArray(), ['starts_at' => now()->toDateTimeString()]));

    $response = $this->actingAs($user)
        ->getJson('/api/agendas/all-events/last-modified');

    $response->assertSuccessful()
        ->assertJson(['last_modified' => $recentEvent->updated_at->format('Y-m-d H:i:s')]);

    // specific month test
    $responseMonth = $this->actingAs($user)
        ->getJson('/api/agendas/all-events/last-modified/3/2026');

    $responseMonth->assertSuccessful()
        ->assertJson(['last_modified' => $recentEvent->updated_at->format('Y-m-d H:i:s')]);

    Carbon::setTestNow();
});

test('all-events endpoint can filter by explicit month and year', function () {
    $user = User::factory()->create(['role' => 'user']);

    $agenda = Agenda::create([
        'name' => 'Personal Agenda',
        'user_id' => $user->id,
    ]);

    $targetDate = Carbon::create(2027, 5, 15, 10, 0, 0);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento objetivo en mayo',
        'starts_at' => $targetDate->toDateTimeString(),
    ]);
    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento otro mes',
        'starts_at' => $targetDate->copy()->addMonth()->toDateTimeString(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/agendas/all-events/{$targetDate->month}/{$targetDate->year}")
        ->assertSuccessful()
        ->assertJsonFragment(['title' => 'Evento objetivo en mayo'])
        ->assertJsonMissing(['title' => 'Evento otro mes']);
});

test('agenda endpoint returns only current month events by default', function () {
    Carbon::setTestNow(Carbon::create(2026, 3, 5, 10, 0, 0));
    $user = User::factory()->create(['role' => 'user']);

    $agenda = Agenda::create([
        'name' => 'Agenda Personal',
        'user_id' => $user->id,
    ]);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento actual',
        'starts_at' => now()->toDateTimeString(),
    ]);
    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento siguiente mes',
        'starts_at' => now()->addMonth()->toDateTimeString(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/agenda/{$agenda->id}")
        ->assertSuccessful()
        ->assertJsonFragment(['title' => 'Evento actual'])
        ->assertJsonMissing(['title' => 'Evento siguiente mes']);

    Carbon::setTestNow();
});

test('agenda endpoint can filter by explicit year and month', function () {
    $user = User::factory()->create(['role' => 'user']);
    $agenda = Agenda::create([
        'name' => 'Agenda Personal',
        'user_id' => $user->id,
    ]);

    $targetDate = Carbon::create(2027, 1, 10, 9, 0, 0);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento objetivo',
        'starts_at' => $targetDate->toDateTimeString(),
    ]);
    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento otro mes',
        'starts_at' => $targetDate->copy()->addMonth()->toDateTimeString(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/agenda/{$agenda->id}/{$targetDate->month}/{$targetDate->year}")
        ->assertSuccessful()
        ->assertJsonFragment(['title' => 'Evento objetivo'])
        ->assertJsonMissing(['title' => 'Evento otro mes']);
});

test('agenda by month endpoint validates month and year', function () {
    $user = User::factory()->create(['role' => 'user']);
    $agenda = Agenda::create([
        'name' => 'Agenda Personal',
        'user_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->getJson("/api/agenda/{$agenda->id}/13/99")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['year', 'month']);
});

test('user cannot view another user personal agenda through singular endpoint', function () {
    $owner = User::factory()->create(['role' => 'user']);
    $other = User::factory()->create(['role' => 'user']);
    $agenda = Agenda::create([
        'name' => 'Agenda Privada',
        'user_id' => $owner->id,
    ]);

    $this->actingAs($other)
        ->getJson("/api/agenda/{$agenda->id}")
        ->assertForbidden();
});

test('admin can view another user personal agenda through singular endpoint', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $owner = User::factory()->create(['role' => 'user']);
    $agenda = Agenda::create([
        'name' => 'Agenda Privada',
        'user_id' => $owner->id,
    ]);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento admin visible',
        'starts_at' => now()->toDateTimeString(),
    ]);

    $this->actingAs($admin)
        ->getJson("/api/agenda/{$agenda->id}")
        ->assertSuccessful()
        ->assertJsonFragment(['title' => 'Evento admin visible']);
});
