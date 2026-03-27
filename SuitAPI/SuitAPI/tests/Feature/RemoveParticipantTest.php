<?php

use App\Models\Agenda;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('owner can remove a participant from a case', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);

    // Create agenda for case
    $agenda = Agenda::create([
        'name' => 'Agenda del caso',
        'suit_case_id' => $case->id,
        'user_id' => $owner->id,
    ]);

    // Add participant (mimic CaseController@addParticipant)
    $case->participants()->attach($participant->id, ['permission_level' => 'read']);
    $case->agenda->users()->syncWithoutDetaching([$participant->id]);

    $this->assertDatabaseHas('case_permissions', [
        'suit_case_id' => $case->id,
        'user_id' => $participant->id,
    ]);

    $this->assertDatabaseHas('agenda_user', [
        'agenda_id' => $agenda->id,
        'user_id' => $participant->id,
    ]);

    // Remove participant
    $response = $this->actingAs($owner)
        ->deleteJson("/api/cases/{$case->id}/participants/{$participant->id}");

    $response->assertOk()
        ->assertJson(['message' => 'Participant removed']);

    $this->assertDatabaseMissing('case_permissions', [
        'suit_case_id' => $case->id,
        'user_id' => $participant->id,
    ]);

    $this->assertDatabaseMissing('agenda_user', [
        'agenda_id' => $agenda->id,
        'user_id' => $participant->id,
    ]);
});

test('admin can remove a participant from a case', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);

    $case->participants()->attach($participant->id, ['permission_level' => 'read']);

    $response = $this->actingAs($admin)
        ->deleteJson("/api/cases/{$case->id}/participants/{$participant->id}");

    $response->assertOk();
    $this->assertDatabaseMissing('case_permissions', [
        'suit_case_id' => $case->id,
        'user_id' => $participant->id,
    ]);
});

test('non-owner lawyer cannot remove a participant', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $stranger = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);
    $case = SuitCase::factory()->create(['lawyer_id' => $owner->id]);

    $case->participants()->attach($participant->id, ['permission_level' => 'read']);

    $response = $this->actingAs($stranger)
        ->deleteJson("/api/cases/{$case->id}/participants/{$participant->id}");

    $response->assertForbidden();
});
