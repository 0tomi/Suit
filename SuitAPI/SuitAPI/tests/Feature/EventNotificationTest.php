<?php

use App\Models\Agenda;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createPersonalEventFor(User $user): Event
{
    $agenda = Agenda::factory()->create([
        'name' => 'Agenda personal',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);

    return Event::factory()->create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento de prueba',
        'description' => null,
        'starts_at' => now()->toDateTimeString(),
        'is_all_day' => true,
        'suit_case_id' => null,
    ]);
}

it('returns null notification when user has not configured one for the event', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $this->actingAs($user)
        ->getJson("/api/events/{$event->id}/notification")
        ->assertSuccessful()
        ->assertJson([
            'event_id' => $event->id,
            'user_id' => $user->id,
            'notify_at' => null,
        ]);
});

it('creates notification config with post endpoint', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $notifyAt = now()->addHour()->format('Y-m-d H:i:s');
    $notifyAtIso = \Illuminate\Support\Carbon::parse($notifyAt)->toISOString();

    $this->actingAs($user)
        ->postJson("/api/events/{$event->id}/notification", [
            'notify_at' => $notifyAtIso,
        ])
        ->assertCreated()
        ->assertJson([
            'event_id' => $event->id,
            'user_id' => $user->id,
        ]);

    $this->assertDatabaseHas('event_notifications', [
        'event_id' => $event->id,
        'user_id' => $user->id,
        'notify_at' => $notifyAt,
    ]);
});

it('returns conflict when creating an existing notification config', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $notifyAtIso = now()->toISOString();

    $this->actingAs($user)->postJson("/api/events/{$event->id}/notification", [
        'notify_at' => $notifyAtIso,
    ])->assertCreated();

    $this->actingAs($user)->postJson("/api/events/{$event->id}/notification", [
        'notify_at' => now()->addHour()->toISOString(),
    ])
        ->assertStatus(409);
});

it('updates existing notification config with put endpoint', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $notifyAt1 = now()->addHour()->format('Y-m-d H:i:s');
    $notifyAt1Iso = \Illuminate\Support\Carbon::parse($notifyAt1)->toISOString();

    $notifyAt2 = now()->addHours(2)->format('Y-m-d H:i:s');
    $notifyAt2Iso = \Illuminate\Support\Carbon::parse($notifyAt2)->toISOString();

    $this->actingAs($user)->postJson("/api/events/{$event->id}/notification", [
        'notify_at' => $notifyAt1Iso,
    ])->assertCreated();

    $this->actingAs($user)->putJson("/api/events/{$event->id}/notification", [
        'notify_at' => $notifyAt2Iso,
    ])
        ->assertSuccessful();

    $this->assertDatabaseHas('event_notifications', [
        'event_id' => $event->id,
        'user_id' => $user->id,
        'notify_at' => $notifyAt2,
    ]);
});

it('returns not found when updating non existing notification config', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $this->actingAs($user)->putJson("/api/events/{$event->id}/notification", [
        'notify_at' => now()->toISOString(),
    ])->assertNotFound();
});

it('removes notification config with delete endpoint', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $this->actingAs($user)->postJson("/api/events/{$event->id}/notification", [
        'notify_at' => now()->toISOString(),
    ])->assertCreated();

    $this->actingAs($user)
        ->deleteJson("/api/events/{$event->id}/notification")
        ->assertNoContent();

    $this->assertDatabaseMissing('event_notifications', [
        'event_id' => $event->id,
        'user_id' => $user->id,
    ]);
});

it('forbids configuring notifications for an event the user cannot access', function () {
    $owner = User::factory()->create(['role' => 'user']);
    $other = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($owner);

    $this->actingAs($other)
        ->postJson("/api/events/{$event->id}/notification", [
            'notify_at' => now()->toISOString(),
        ])
        ->assertForbidden();
});

it('validates notification minutes range', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user);

    $this->actingAs($user)
        ->postJson("/api/events/{$event->id}/notification", [
            'notify_at' => 'not-a-valid-date',
        ])
        ->assertJsonValidationErrors(['notify_at']);
});

it('can fetch notifications incrementally via syncDown', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event1 = createPersonalEventFor($user);
    $event2 = createPersonalEventFor($user);

    $this->actingAs($user)->postJson("/api/events/{$event1->id}/notification", ['notify_at' => now()->toISOString()]);
    $this->actingAs($user)->postJson("/api/events/{$event2->id}/notification", ['notify_at' => now()->addHour()->toISOString()]);

    $response = $this->actingAs($user)
        ->getJson('/api/notifications/sync?since=2000-01-01')
        ->assertSuccessful();

    expect($response->json())->toHaveCount(2);
});

it('can bulk create or update notifications via syncUp', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event1 = createPersonalEventFor($user);
    $event2 = createPersonalEventFor($user);

    $notifyAt1Update = now()->addHour()->format('Y-m-d H:i:s');
    $notifyAt2Create = now()->addHours(2)->format('Y-m-d H:i:s');

    // Initial config for event 1
    $this->actingAs($user)->postJson("/api/events/{$event1->id}/notification", ['notify_at' => now()->toISOString()]);

    $response = $this->actingAs($user)
        ->postJson('/api/notifications/sync', [
            'notifications' => [
                [
                    'event_id' => $event1->id,
                    'notify_at' => \Illuminate\Support\Carbon::parse($notifyAt1Update)->toISOString(), // updated
                ],
                [
                    'event_id' => $event2->id,
                    'notify_at' => \Illuminate\Support\Carbon::parse($notifyAt2Create)->toISOString(), // created
                ],
            ],
        ])
        ->assertSuccessful();

    $synced = $response->json('synced');
    expect($synced)->toHaveCount(2);

    $this->assertDatabaseHas('event_notifications', [
        'event_id' => $event1->id,
        'notify_at' => $notifyAt1Update,
    ]);

    $this->assertDatabaseHas('event_notifications', [
        'event_id' => $event2->id,
        'notify_at' => $notifyAt2Create,
    ]);
});

it('retrieves and deletes notifications due until today', function () {
    $user = User::factory()->create(['role' => 'user']);
    $event = createPersonalEventFor($user); // Date is today

    // Notify exactly today
    $this->actingAs($user)->postJson("/api/events/{$event->id}/notification", ['notify_at' => now()->toISOString()]);

    // Should fetch the notification
    $response = $this->actingAs($user)
        ->getJson('/api/notifications/until-today')
        ->assertSuccessful();

    expect($response->json())->toHaveCount(1);
    expect($response->json('0.event_id'))->toBe($event->id);

    // Second call should return empty because it was soft/hard deleted
    $response2 = $this->actingAs($user)
        ->getJson('/api/notifications/until-today')
        ->assertSuccessful();

    expect($response2->json())->toHaveCount(0);
});

it('returns the last modified timestamp of notifications', function () {
    $user = User::factory()->create(['role' => 'user']);

    $response = $this->actingAs($user)
        ->getJson('/api/notifications/last-modified')
        ->assertSuccessful();

    expect($response->json('last_modified'))->toBeNull(); // Empty at first

    $event = createPersonalEventFor($user);
    $this->actingAs($user)->postJson("/api/events/{$event->id}/notification", ['notify_at' => now()->toISOString()]);

    $response2 = $this->actingAs($user)
        ->getJson('/api/notifications/last-modified')
        ->assertSuccessful();

    expect($response2->json('last_modified'))->not->toBeNull();
});
