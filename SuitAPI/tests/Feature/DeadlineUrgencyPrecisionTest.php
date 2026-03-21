<?php

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\User;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'lawyer']);
    $this->agenda = Agenda::factory()->create(['user_id' => $this->user->id]);
    
    // Asegurar que el umbral de urgencia es de 2 días
    Setting::query()->updateOrCreate(
        ['key' => Deadline::SETTING_URGENCY_DAYS],
        ['value' => '2']
    );
});

function createTestDeadline(string $dueDate, User $user, Agenda $agenda): Deadline
{
    $event = Event::factory()->create([
        'agenda_id' => $agenda->id,
        'starts_at' => $dueDate,
    ]);

    return Deadline::factory()->create([
        'event_id' => $event->id,
        'due_date' => $dueDate,
        'priority' => 'Normal',
        'status' => 'Pendiente',
        'manually_urgent' => false,
    ]);
}

test('deadline with more than 48h (2 days + 2 hours) stays Normal', function () {
    // Escenario: Hoy es 24/03 08:00 AM. El vencimiento es 26/03 10:00 AM (48h + 2h = 50h restantes)
    $now = Carbon::parse('2026-03-24 08:00:00');
    Carbon::setTestNow($now);

    $dueDate = '2026-03-26 10:00:00';
    $deadline = createTestDeadline($dueDate, $this->user, $this->agenda);

    // Act: Obtener el vencimiento (dispara inferState)
    $response = $this->actingAs($this->user)->getJson("/api/vencimientos/{$deadline->id}");

    // Assert: Debe ser Normal (más de 2 días de margen real)
    $response->assertOk()->assertJsonFragment(['priority' => 'Normal']);
});

test('deadline with less than 48h (2 days - 2 hours) becomes Urgente', function () {
    // Escenario: Hoy es 24/03 08:00 AM. El vencimiento es 26/03 06:00 AM (48h - 2h = 46h restantes)
    $now = Carbon::parse('2026-03-24 08:00:00');
    Carbon::setTestNow($now);

    $dueDate = '2026-03-26 06:00:00';
    $deadline = createTestDeadline($dueDate, $this->user, $this->agenda);

    // Act
    $response = $this->actingAs($this->user)->getJson("/api/vencimientos/{$deadline->id}");

    // Assert: Debe ser Urgente (dentro del umbral de 2 días)
    $response->assertOk()->assertJsonFragment(['priority' => 'Urgente']);
});

test('urgency threshold is dynamic and respects administrator configuration (e.g., 5 days)', function () {
    // Escenario: El administrador cambia el umbral a 5 días (120 horas)
    Setting::query()->updateOrCreate(
        ['key' => Deadline::SETTING_URGENCY_DAYS],
        ['value' => '5']
    );

    // Hoy es 24/03 08:00 AM.
    $now = Carbon::parse('2026-03-24 08:00:00');
    Carbon::setTestNow($now);

    // 1. Caso Normal: 5 días + 2 horas (122 horas restantes)
    $dueDateNormal = '2026-03-29 10:00:00';
    $deadlineNormal = createTestDeadline($dueDateNormal, $this->user, $this->agenda);
    
    $this->actingAs($this->user)->getJson("/api/vencimientos/{$deadlineNormal->id}")
        ->assertJsonFragment(['priority' => 'Normal']);

    // 2. Caso Urgente: 5 días - 2 horas (118 horas restantes)
    $dueDateUrgent = '2026-03-29 06:00:00';
    $deadlineUrgent = createTestDeadline($dueDateUrgent, $this->user, $this->agenda);
    
    $this->actingAs($this->user)->getJson("/api/vencimientos/{$deadlineUrgent->id}")
        ->assertJsonFragment(['priority' => 'Urgente']);
});
