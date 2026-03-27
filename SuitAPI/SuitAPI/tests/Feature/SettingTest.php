<?php

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function settingAdmin(): User
{
    return User::factory()->create(['role' => 'admin']);
}

function settingLawyer(): User
{
    return User::factory()->create(['role' => 'lawyer']);
}

// ─── Seed helper ─────────────────────────────────────────────────────────────

function seedDeadlineUrgencyDays(int $days = 2): void
{
    Setting::set('deadline_urgency_days', (string) $days);
}

// ─── GET /api/settings ───────────────────────────────────────────────────────

test('admin can list settings', function () {
    $admin = settingAdmin();
    seedDeadlineUrgencyDays(2);

    $response = $this->actingAs($admin)->getJson('/api/settings');

    $response->assertOk();
    $response->assertJsonFragment(['key' => 'deadline_urgency_days', 'value' => '2']);
});

test('non-admin cannot list settings', function () {
    $lawyer = settingLawyer();
    seedDeadlineUrgencyDays(2);

    $this->actingAs($lawyer)->getJson('/api/settings')->assertForbidden();
});

// ─── PUT /api/settings/{key} ─────────────────────────────────────────────────

test('admin can update urgency days setting', function () {
    $admin = settingAdmin();
    seedDeadlineUrgencyDays(2);

    $response = $this->actingAs($admin)->putJson('/api/settings/deadline_urgency_days', [
        'value' => '5',
    ]);

    $response->assertOk()->assertJson(['key' => 'deadline_urgency_days', 'value' => '5']);
    $this->assertDatabaseHas('settings', ['key' => 'deadline_urgency_days', 'value' => '5']);
});

test('non-admin cannot update settings', function () {
    $lawyer = settingLawyer();
    seedDeadlineUrgencyDays(2);

    $this->actingAs($lawyer)->putJson('/api/settings/deadline_urgency_days', [
        'value' => '99',
    ])->assertForbidden();
});

test('updating a non-existent setting key returns 404', function () {
    $admin = settingAdmin();

    $this->actingAs($admin)->putJson('/api/settings/non_existent_key', [
        'value' => '10',
    ])->assertNotFound();
});

test('value field is required when updating a setting', function () {
    $admin = settingAdmin();
    seedDeadlineUrgencyDays(2);

    $this->actingAs($admin)->putJson('/api/settings/deadline_urgency_days', [])->assertUnprocessable();
});

// ─── Configurable urgency days afecta inferState ─────────────────────────────

test('deadline_urgency_days setting is respected by inferState', function () {
    $user = settingLawyer();
    $agenda = Agenda::factory()->create(['user_id' => $user->id]);
    $event = Event::factory()->create(['agenda_id' => $agenda->id, 'starts_at' => now()]);

    // Configuramos 5 días como umbral
    seedDeadlineUrgencyDays(5);

    // Vencimiento con 4 días de margen → debería hacerse Urgente con umbral de 5
    $deadline = Deadline::factory()->create([
        'event_id' => $event->id,
        'due_date' => now()->addDays(4)->format('Y-m-d'),
        'priority' => 'Normal',
        'manually_urgent' => false,
        'status' => 'Pendiente',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()->assertJsonFragment(['priority' => 'Urgente']);
});
