<?php

use App\Models\Agenda;
use App\Models\Event;
use App\Models\EventType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('lists event types for authenticated users', function () {
    $user = User::factory()->create(['role' => 'user']);

    EventType::create(['name' => 'Audiencia', 'color' => '#00AAFF']);

    $this->actingAs($user)
        ->getJson('/api/event-types')
        ->assertSuccessful()
        ->assertJsonFragment(['name' => EventType::DEFAULT_NAME])
        ->assertJsonFragment(['name' => 'Audiencia']);
});

it('allows admin to create event type', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($admin)
        ->postJson('/api/event-types', [
            'name' => 'Reunion',
            'color' => '#123ABC',
        ])
        ->assertCreated()
        ->assertJsonFragment(['name' => 'Reunion']);

    $this->assertDatabaseHas('event_types', ['name' => 'Reunion']);
});

it('forbids non admin from creating event type', function () {
    $user = User::factory()->create(['role' => 'user']);

    $this->actingAs($user)
        ->postJson('/api/event-types', [
            'name' => 'Reunion',
        ])
        ->assertForbidden();
});

it('allows admin to update event type', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $type = EventType::create(['name' => 'Temporal', 'color' => '#111111']);

    $this->actingAs($admin)
        ->putJson("/api/event-types/{$type->id}", [
            'name' => 'Actualizado',
            'color' => '#222222',
        ])
        ->assertSuccessful()
        ->assertJsonFragment([
            'id' => $type->id,
            'name' => 'Actualizado',
            'color' => '#222222',
        ]);

    $this->assertDatabaseHas('event_types', [
        'id' => $type->id,
        'name' => 'Actualizado',
        'color' => '#222222',
    ]);
});

it('forbids non admin from updating event type', function () {
    $user = User::factory()->create(['role' => 'user']);
    $type = EventType::create(['name' => 'Temporal']);

    $this->actingAs($user)
        ->putJson("/api/event-types/{$type->id}", [
            'name' => 'Actualizado',
        ])
        ->assertForbidden();
});

it('allows admin to update color of default event type', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $defaultType = EventType::where('name', EventType::DEFAULT_NAME)->firstOrFail();

    $this->actingAs($admin)
        ->putJson("/api/event-types/{$defaultType->id}", [
            'color' => '#ef4444',
        ])
        ->assertSuccessful()
        ->assertJsonFragment(['color' => '#ef4444']);

    $this->assertDatabaseHas('event_types', [
        'id' => $defaultType->id,
        'name' => EventType::DEFAULT_NAME,
        'color' => '#ef4444',
    ]);
});

it('does not allow renaming default event type', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $defaultType = EventType::where('name', EventType::DEFAULT_NAME)->firstOrFail();

    $this->actingAs($admin)
        ->putJson("/api/event-types/{$defaultType->id}", [
            'name' => 'Nuevo nombre',
            'color' => '#333333',
        ])
        ->assertForbidden()
        ->assertJsonFragment(['message' => 'El tipo de evento "Otro" no puede cambiar su nombre.']);
});

it('allows admin to delete event type when not in use', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $type = EventType::create(['name' => 'Temporal']);

    $this->actingAs($admin)
        ->deleteJson("/api/event-types/{$type->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('event_types', ['id' => $type->id]);
});

it('does not allow deleting default event type', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $defaultType = EventType::where('name', EventType::DEFAULT_NAME)->firstOrFail();

    $this->actingAs($admin)
        ->deleteJson("/api/event-types/{$defaultType->id}")
        ->assertForbidden()
        ->assertJsonFragment(['message' => 'El tipo de evento "Otro" no puede ser eliminado.']);
});

it('does not allow deleting event type in use', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $eventType = EventType::create(['name' => 'En Uso']);
    $agenda = Agenda::create([
        'name' => 'Agenda Admin',
        'user_id' => $admin->id,
        'suit_case_id' => null,
    ]);

    Event::create([
        'agenda_id' => $agenda->id,
        'event_type_id' => $eventType->id,
        'title' => 'Evento asociado',
        'description' => null,
        'starts_at' => now()->toDateTimeString(),
        'is_all_day' => true,
        'suit_case_id' => null,
    ]);

    $this->actingAs($admin)
        ->deleteJson("/api/event-types/{$eventType->id}")
        ->assertUnprocessable()
        ->assertJsonFragment(['message' => 'No se puede eliminar un tipo de evento en uso.']);
});

it('returns event types last modified timestamp', function () {
    $user = User::factory()->create(['role' => 'user']);

    EventType::create(['name' => 'Recordatorio']);

    $response = $this->actingAs($user)
        ->getJson('/api/event-types/last-modified')
        ->assertSuccessful();

    expect($response->json('last_modified'))->not->toBeNull();
});

it('assigns default event type when creating an event without event_type_id', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $agenda = Agenda::create([
        'name' => 'Agenda personal',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);
    $defaultType = EventType::where('name', EventType::DEFAULT_NAME)->firstOrFail();

    $response = $this->actingAs($user)
        ->postJson('/api/events', [
            'agenda_id' => $agenda->id,
            'title' => 'Sin tipo',
            'starts_at' => now()->toDateTimeString(),
        ])
        ->assertSuccessful();

    expect($response->json('event_type_id'))->toBe($defaultType->id);
    $this->assertDatabaseHas('events', [
        'id' => $response->json('id'),
        'event_type_id' => $defaultType->id,
    ]);
});

it('uses database default event type when event_type_id is omitted', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $agenda = Agenda::create([
        'name' => 'Agenda DB default',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);
    $defaultType = EventType::where('name', EventType::DEFAULT_NAME)->firstOrFail();

    DB::table('events')->insert([
        'agenda_id' => $agenda->id,
        'suit_case_id' => null,
        'title' => 'Legacy event',
        'description' => null,
        'starts_at' => now()->toDateTimeString(),
        'is_all_day' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $event = Event::query()->where('title', 'Legacy event')->firstOrFail();

    expect($event->event_type_id)->toBe($defaultType->id);
});
