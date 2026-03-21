<?php

/**
 * DeadlineEdgeCasesTest — Hipótesis derivadas del commit e81c4ec.
 *
 * Cubre escenarios cotidianos y rebuscados que el suite principal no contempla.
 */

use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers locales ──────────────────────────────────────────────────────────

function ecUser(string $role = 'lawyer'): User
{
    return User::factory()->create(['role' => $role]);
}

function ecAgenda(User $user): Agenda
{
    return Agenda::factory()->create(['user_id' => $user->id]);
}

function ecEvent(Agenda $agenda): Event
{
    return Event::factory()->create([
        'agenda_id' => $agenda->id,
        'starts_at' => now()->toDateTimeString(),
    ]);
}

function ecDeadline(Event $event, array $overrides = []): Deadline
{
    return Deadline::factory()->create(array_merge([
        'event_id' => $event->id,
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'priority' => 'Normal',
        'manually_urgent' => false,
        'status' => 'Pendiente',
    ], $overrides));
}

// ─── H1: Validación — prorrogar con fecha hoy debe fallar ────────────────────

/**
 * La regla `after:today` NO acepta today mismo; debe ser estrictamente futura.
 * H1: Usario envía due_date=hoy esperando que pase. En un día agitado de tribunal
 * esto podría ocurrir por error. El sistema debe rechazarlo con 422.
 */
test('H1: prorrogar with due_date=today is rejected (must be after:today)', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Vencido',
    ]);

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => now()->format('Y-m-d'), // Hoy, no mañana
    ]);

    $response->assertUnprocessable();
});

// ─── H3: Máquina de estados — Cumplido no puede ser prorrogado ───────────────

/**
 * H3: Un vencimiento marcado como Cumplido no debería poder prorrogarse.
 * Si el abogado completa un trámite por error y luego intenta prorrogarlo,
 * la máquina de estados debería proteger la integridad.
 * El controller requiere que el estado sea Vencido; Cumplido debe ser rechazado.
 */
test('H3: cannot prorrogar a deadline that is already Cumplido', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Cumplido',
    ]);

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => now()->addDays(15)->format('Y-m-d'),
    ]);

    $response->assertUnprocessable();
});

/**
 * H3b: Un vencimiento en estado Pendiente tampoco puede ser prorrogado.
 * Prorrogar es exclusivo de Vencido.
 */
test('H3b: cannot prorrogar a deadline that is Pendiente', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->addDays(10)->format('Y-m-d'),
        'status' => 'Pendiente',
    ]);

    $response = $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/prorrogar", [
        'due_date' => now()->addDays(20)->format('Y-m-d'),
    ]);

    $response->assertUnprocessable();
});

// ─── H4: Setting corruption — valor vacío eleva todo a Urgente ───────────────

/**
 * H4: Si el admin guarda `deadline_urgency_days = ""` (string vacío),
 * el cast `(int)""` retorna 0. Esto haría que `daysUntilDue <= 0` sea
 * SIEMPRE falso para fechas futuras, es decir, ningún vencimiento se elevaría
 * automáticamente. El mayor riesgo es el opuesto: `(int)"abc"` también da 0.
 * La validación debería filtrar esto, devolviendo 422 si value no es numérico.
 */
test('H4: updating deadline_urgency_days with empty string is rejected', function () {
    $admin = ecUser('admin');
    Setting::set('deadline_urgency_days', '2');

    $response = $this->actingAs($admin)->putJson('/api/settings/deadline_urgency_days', [
        'value' => '',
    ]);

    $response->assertUnprocessable();
});

test('H4b: updating deadline_urgency_days with non-numeric string is rejected', function () {
    $admin = ecUser('admin');
    Setting::set('deadline_urgency_days', '2');

    $response = $this->actingAs($admin)->putJson('/api/settings/deadline_urgency_days', [
        'value' => 'muchos',
    ]);

    $response->assertUnprocessable();
});

test('H4c: updating deadline_urgency_days with negative number is rejected', function () {
    $admin = ecUser('admin');
    Setting::set('deadline_urgency_days', '2');

    $response = $this->actingAs($admin)->putJson('/api/settings/deadline_urgency_days', [
        'value' => '-1',
    ]);

    $response->assertUnprocessable();
});

// ─── H5: manually_urgent sync — update priority=Normal limpia el flag ─────────

/**
 * H5: Si el usuario crea un vencimiento Urgente manualmente y luego lo actualiza
 * con priority=Normal, el campo `manually_urgent` debe setearse en false.
 * Así, la inferencia automática puede volver a operar normalmente.
 */
test('H5: updating priority to Normal clears manually_urgent flag', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->addDays(10)->format('Y-m-d'),
        'priority' => 'Urgente',
        'manually_urgent' => true,
    ]);

    $response = $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'priority' => 'Normal',
    ]);

    $response->assertOk();
    $this->assertDatabaseHas('deadlines', [
        'id' => $deadline->id,
        'manually_urgent' => false,
    ]);
});

/**
 * H5b: Actualizar el vencimiento SIN enviar priority no debe tocar manually_urgent.
 * Un PATCH parcial (solo title, por ejemplo) no debe resetear el flag.
 */
test('H5b: updating deadline without priority does NOT change manually_urgent', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->addDays(10)->format('Y-m-d'),
        'priority' => 'Urgente',
        'manually_urgent' => true,
    ]);

    $this->actingAs($user)->putJson("/api/vencimientos/{$deadline->id}", [
        'title' => 'Nuevo título',
    ])->assertOk();

    $this->assertDatabaseHas('deadlines', [
        'id' => $deadline->id,
        'manually_urgent' => true,
    ]);
});

// ─── H6: completar un Vencido funciona (flujo válido) ───────────────────────

/**
 * H6: Completar un vencimiento desde estado Vencido es un flujo normal.
 * Verificamos que funcione y que el estado sea inmutable post-completar.
 */
test('H6: can complete a Vencido deadline and it remains Cumplido after inferState', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->subDay()->format('Y-m-d'),
        'status' => 'Vencido',
    ]);

    $this->actingAs($user)->postJson("/api/vencimientos/{$deadline->id}/completar")
        ->assertOk()
        ->assertJsonFragment(['status' => 'Cumplido']);

    // Al hacer show, inferState no debe revertir el estado Cumplido
    $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}")
        ->assertOk()
        ->assertJsonFragment(['status' => 'Cumplido']);
});

// ─── H9: Boundary — due_date es HOY (fin del día) ────────────────────────────

/**
 * H9: Un vencimiento con due_date=hoy NO está vencido aún (vence a las 23:59:59).
 * `inferState()` usa `endOfDay()`, por lo tanto debe considerar hoy como dentro del umbral.
 * Dado que 0 días <= urgency_days (2 por defecto), debe elevarse a Urgente.
 */
test('H9: deadline due today is NOT overdue and IS elevated to Urgente', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $deadline = ecDeadline($event, [
        'due_date' => now()->format('Y-m-d'), // Hoy
        'priority' => 'Normal',
        'manually_urgent' => false,
        'status' => 'Pendiente',
    ]);

    $response = $this->actingAs($user)->getJson("/api/vencimientos/{$deadline->id}");

    $response->assertOk()
        ->assertJsonFragment(['status' => 'Pendiente'])
        ->assertJsonFragment(['priority' => 'Urgente']);
});

// ─── H10: Unauthenticated access a endpoints protegidos ──────────────────────

/**
 * H10: Sin token, los endpoints de settings y vencimientos deben retornar 401.
 * Validación básica del middleware de autenticación en los nuevos endpoints.
 */
test('H10: unauthenticated request to GET /api/settings returns 401', function () {
    $this->getJson('/api/settings')->assertUnauthorized();
});

test('H10b: unauthenticated request to PUT /api/settings/{key} returns 401', function () {
    Setting::set('deadline_urgency_days', '2');
    $this->putJson('/api/settings/deadline_urgency_days', ['value' => '5'])->assertUnauthorized();
});

// ─── H7: store silencioso con título por defecto ─────────────────────────────

/**
 * H7: Si se crea un vencimiento sin title ni description, el resultado en DB
 * es title='Vencimiento'. Esto es intencional, pero verificamos que el endpoint
 * no rechaza la solicitud y que el valor por defecto es el correcto.
 */
test('H7: creating deadline without title or description uses Vencimiento as default title', function () {
    $user = ecUser();
    $agenda = ecAgenda($user);
    $event = ecEvent($agenda);

    $response = $this->actingAs($user)->postJson('/api/vencimientos', [
        'event_id' => $event->id,
        'due_date' => now()->addDays(30)->format('Y-m-d'),
        // Sin title ni description
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('deadlines', [
        'title' => 'Vencimiento',
    ]);
});

// ─── Autorización cruzada: abogado no puede ver vencimiento ajeno ─────────────

/**
 * Un abogado solo debe poder ver vencimientos de sus propias agendas o de
 * casos en los que participa como colaborador.
 */
test('lawyer cannot view another lawyers deadline', function () {
    $owner = ecUser();
    $other = ecUser();

    $agenda = ecAgenda($owner);
    $event = ecEvent($agenda);
    $deadline = ecDeadline($event);

    $this->actingAs($other)->getJson("/api/vencimientos/{$deadline->id}")
        ->assertForbidden();
});

/**
 * Un abogado no puede completar el vencimiento de otro abogado.
 */
test('lawyer cannot complete another lawyers deadline', function () {
    $owner = ecUser();
    $other = ecUser();

    $agenda = ecAgenda($owner);
    $event = ecEvent($agenda);
    $deadline = ecDeadline($event, ['status' => 'Vencido']);

    $this->actingAs($other)->postJson("/api/vencimientos/{$deadline->id}/completar")
        ->assertForbidden();
});
