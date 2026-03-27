<?php

use App\Models\Agenda;
use App\Models\Client;
use App\Models\Document;
use App\Models\Event;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// ─── Cases ───────────────────────────────────────────────────────

test('cases last-modified returns the latest updated_at from accessible cases', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $response = $this->actingAs($user)->getJson('/api/cases/last-modified');

    $response->assertOk()
        ->assertJsonStructure(['last_modified'])
        ->assertJson(['last_modified' => $case->updated_at->toJSON()]);
});

test('cases last-modified returns null when user has no cases', function () {
    $user = User::factory()->create(['role' => 'lawyer']);

    $response = $this->actingAs($user)->getJson('/api/cases/last-modified');

    $response->assertOk()
        ->assertJson(['last_modified' => null]);
});

test('cases last-modified for admin uses all cases', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $owner = User::factory()->create(['role' => 'lawyer']);

    $older = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
    $older->forceFill(['updated_at' => now()->subHour()])->saveQuietly();

    $latest = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
    $latest->forceFill(['updated_at' => now()->subMinute()])->saveQuietly();

    $this->actingAs($admin)->getJson('/api/cases/last-modified')
        ->assertOk()
        ->assertJson(['last_modified' => $latest->fresh()->updated_at->toJSON()]);
});

test('case last-modified returns updated_at of a specific case', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);

    $response = $this->actingAs($user)->getJson("/api/cases/{$case->id}/last-modified");

    $response->assertOk()
        ->assertJson([
            'case' => $case->updated_at->toJSON(),
            'partes' => null,
            'gastos' => null,
            'honorarios' => null,
            'documentos' => null,
            'eventos' => null,
            'clientes' => null,
            'multimedia' => null,
            'archivos' => null,
        ]);
});

test('case last-modified returns 403 for unauthorized user', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $other = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);

    $response = $this->actingAs($other)->getJson("/api/cases/{$case->id}/last-modified");

    $response->assertForbidden();
});

// ─── Documents ───────────────────────────────────────────────────

test('documents last-modified returns the latest updated_at from accessible documents', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);
    $doc = Document::factory()->create(['user_id' => $user->id, 'suit_case_id' => $case->id]);

    $response = $this->actingAs($user)->getJson('/api/documents/last-modified');

    $response->assertOk()
        ->assertJsonStructure(['last_modified'])
        ->assertJson(['last_modified' => $doc->updated_at->toJSON()]);
});

test('documents last-modified returns null when user has no documents', function () {
    $user = User::factory()->create(['role' => 'lawyer']);

    $response = $this->actingAs($user)->getJson('/api/documents/last-modified');

    $response->assertOk()
        ->assertJson(['last_modified' => null]);
});

test('documents last-modified for admin uses all documents', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $owner = User::factory()->create(['role' => 'lawyer']);

    $older = Document::factory()->create(['user_id' => $owner->id]);
    $older->forceFill(['updated_at' => now()->subHour()])->saveQuietly();

    $latest = Document::factory()->create(['user_id' => $owner->id]);
    $latest->forceFill(['updated_at' => now()->subMinute()])->saveQuietly();

    $this->actingAs($admin)->getJson('/api/documents/last-modified')
        ->assertOk()
        ->assertJson(['last_modified' => $latest->fresh()->updated_at->toJSON()]);
});

test('document last-modified returns updated_at of a specific document', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $user->id]);
    $doc = Document::factory()->create(['user_id' => $user->id, 'suit_case_id' => $case->id]);

    $response = $this->actingAs($user)->getJson("/api/documents/{$doc->id}/last-modified");

    $response->assertOk()
        ->assertJson(['last_modified' => $doc->updated_at->toJSON()]);
});

// ─── Clients ─────────────────────────────────────────────────────

test('clients last-modified returns the latest updated_at', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $client = Client::factory()->create();

    $response = $this->actingAs($user)->getJson('/api/clients/last-modified');

    $response->assertOk()
        ->assertJsonStructure(['last_modified'])
        ->assertJson(['last_modified' => $client->updated_at->toJSON()]);
});

test('clients last-modified returns null when no clients exist', function () {
    $user = User::factory()->create(['role' => 'lawyer']);

    $response = $this->actingAs($user)->getJson('/api/clients/last-modified');

    $response->assertOk()
        ->assertJson(['last_modified' => null]);
});

test('client last-modified returns updated_at of a specific client', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $client = Client::factory()->create();

    $response = $this->actingAs($user)->getJson("/api/clients/{$client->id}/last-modified");

    $response->assertOk()
        ->assertJson(['last_modified' => $client->updated_at->toJSON()]);
});

// ─── Users ───────────────────────────────────────────────────────

test('users last-modified returns the latest updated_at', function () {
    $user = User::factory()->create(['role' => 'lawyer']);

    $response = $this->actingAs($user)->getJson('/api/users/last-modified');

    $response->assertOk()
        ->assertJsonStructure(['last_modified']);
    expect($response->json('last_modified'))->not->toBeNull();
});

test('user last-modified returns updated_at of a specific user', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $other = User::factory()->create();

    $response = $this->actingAs($user)->getJson("/api/users/{$other->id}/last-modified");

    $response->assertOk()
        ->assertJson(['last_modified' => $other->updated_at->toJSON()]);
});

// ─── Agendas ─────────────────────────────────────────────────────

test('agendas last-modified returns null when user has no accessible agendas', function () {
    $user = User::factory()->create(['role' => 'lawyer']);

    $this->actingAs($user)
        ->getJson('/api/agendas/last-modified')
        ->assertOk()
        ->assertJson(['last_modified' => null]);
});

test('agendas last-modified returns the latest updated_at from accessible agendas', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $other = User::factory()->create(['role' => 'lawyer']);

    $oldAgenda = Agenda::create([
        'name' => 'Personal',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);
    $oldAgenda->forceFill(['updated_at' => now()->subHour()])->saveQuietly();

    $latestAgenda = Agenda::create([
        'name' => 'Case agenda',
        'user_id' => $other->id,
        'suit_case_id' => null,
    ]);
    $latestAgenda->forceFill(['updated_at' => now()->subMinute()])->saveQuietly();
    $latestAgenda->user_id = $user->id;
    $latestAgenda->save();

    $this->actingAs($user)
        ->getJson('/api/agendas/last-modified')
        ->assertOk()
        ->assertJson([
            'last_modified' => $latestAgenda->fresh()->updated_at->format('Y-m-d H:i:s'),
        ]);
});

test('agendas last-modified reflects when a case permission grants access to a shared agenda', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);

    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
    $agenda = Agenda::create([
        'name' => 'Agenda compartida',
        'user_id' => $owner->id,
        'suit_case_id' => $case->id,
    ]);
    $agenda->forceFill(['updated_at' => now()->subHour()])->saveQuietly();

    $case->participants()->attach($participant->id, [
        'permission_level' => 'read',
        'created_at' => now()->subMinute(),
        'updated_at' => now()->subMinute(),
    ]);

    $lastModified = DB::table('agenda_user')
        ->where('user_id', $participant->id)
        ->where('agenda_id', $agenda->id)
        ->value('updated_at');

    $this->actingAs($participant)
        ->getJson('/api/agendas/last-modified')
        ->assertOk()
        ->assertJson([
            'last_modified' => \Illuminate\Support\Carbon::parse($lastModified)->format('Y-m-d H:i:s'),
        ]);
});

test('agendas last-modified changes when a user loses access to a shared agenda', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);

    Agenda::create([
        'name' => 'Personal participante',
        'user_id' => $participant->id,
        'suit_case_id' => null,
    ]);

    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);
    $agenda = Agenda::create([
        'name' => 'Agenda revocable',
        'user_id' => $owner->id,
        'suit_case_id' => $case->id,
    ]);

    $case->participants()->attach($participant->id, ['permission_level' => 'read']);
    $case->participants()->detach($participant->id);

    $this->assertDatabaseMissing('agenda_user', [
        'user_id' => $participant->id,
        'agenda_id' => $agenda->id,
    ]);

    $lastModified = DB::table('agenda_user')
        ->where('user_id', $participant->id)
        ->max('updated_at');

    $this->actingAs($participant)
        ->getJson('/api/agendas/last-modified')
        ->assertOk()
        ->assertJson([
            'last_modified' => \Illuminate\Support\Carbon::parse($lastModified)->format('Y-m-d H:i:s'),
        ]);
});

test('agenda month last-modified returns latest updated_at within requested period', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $agenda = Agenda::create([
        'name' => 'Agenda personal',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);

    $olderEvent = Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento temprano',
        'starts_at' => '2026-04-05 00:00:00',
    ]);
    $olderEvent->forceFill(['updated_at' => '2026-04-05 09:00:00'])->saveQuietly();

    $newerEvent = Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento reciente',
        'starts_at' => '2026-04-20 00:00:00',
    ]);
    $newerEvent->forceFill(['updated_at' => '2026-04-20 19:15:30'])->saveQuietly();

    $outsideEvent = Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento otro mes',
        'starts_at' => '2026-05-02 00:00:00',
    ]);
    $outsideEvent->forceFill(['updated_at' => '2026-05-02 23:59:59'])->saveQuietly();

    $this->actingAs($user)
        ->getJson("/api/agenda/{$agenda->id}/last-modified/4/2026")
        ->assertOk()
        ->assertJson([
            'last_modified' => $newerEvent->fresh()->updated_at->format('Y-m-d H:i:s'),
        ]);
});

test('agenda month last-modified returns null when agenda has no events in requested month', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $agenda = Agenda::create([
        'name' => 'Agenda vacia',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento fuera de mes',
        'starts_at' => '2026-05-10 00:00:00',
    ]);

    $this->actingAs($user)
        ->getJson("/api/agenda/{$agenda->id}/last-modified/4/2026")
        ->assertOk()
        ->assertJson([
            'last_modified' => null,
        ]);
});

test('agenda month last-modified validates month and year params', function () {
    $user = User::factory()->create(['role' => 'lawyer']);
    $agenda = Agenda::create([
        'name' => 'Agenda personal',
        'user_id' => $user->id,
        'suit_case_id' => null,
    ]);

    $this->actingAs($user)
        ->getJson("/api/agenda/{$agenda->id}/last-modified/13/99")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month', 'year']);
});

test('agenda month last-modified returns 403 for unauthorized user', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $other = User::factory()->create(['role' => 'lawyer']);

    $agenda = Agenda::create([
        'name' => 'Agenda privada',
        'user_id' => $owner->id,
        'suit_case_id' => null,
    ]);

    $this->actingAs($other)
        ->getJson("/api/agenda/{$agenda->id}/last-modified/4/2026")
        ->assertForbidden();
});

test('agenda month last-modified allows admin to check another user agenda', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $admin = User::factory()->create(['role' => 'admin']);

    $agenda = Agenda::create([
        'name' => 'Agenda privada',
        'user_id' => $owner->id,
        'suit_case_id' => null,
    ]);

    Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Evento admin',
        'starts_at' => '2026-04-10 00:00:00',
    ]);

    $this->actingAs($admin)
        ->getJson("/api/agenda/{$agenda->id}/last-modified/4/2026")
        ->assertOk();
});

// ─── Auth Guard ──────────────────────────────────────────────────

test('last-modified endpoints require authentication', function () {
    $this->getJson('/api/cases/last-modified')->assertUnauthorized();
    $this->getJson('/api/documents/last-modified')->assertUnauthorized();
    $this->getJson('/api/clients/last-modified')->assertUnauthorized();
    $this->getJson('/api/users/last-modified')->assertUnauthorized();
    $this->getJson('/api/agendas/last-modified')->assertUnauthorized();
});
