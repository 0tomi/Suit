<?php

use App\Models\Agenda;
use App\Models\Event;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('participant can view case agenda and events', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'user']);

    $case = SuitCase::factory()->create([
        'title' => 'Agenda Test Case',
        'lawyer_id' => $lawyer->id,
        'start_date' => now(),
        'status' => 'active',
    ]);

    // Add participant
    $case->participants()->attach($participant->id, ['permission_level' => 'read']);

    // Create Agenda and Event
    $agenda = Agenda::factory()->create([
        'name' => 'Case Agenda',
        'suit_case_id' => $case->id,
        'user_id' => $lawyer->id,
    ]);

    $event = Event::factory()->create([
        'agenda_id' => $agenda->id,
        'title' => 'Case Hearing',
        'starts_at' => now()->toDateTimeString(),
    ]);

    $response = $this->actingAs($participant)->getJson("/api/cases/{$case->id}/agenda");

    $response->assertStatus(200)
        ->assertJsonFragment(['title' => 'Case Hearing']);
});

test('non-participant cannot view case agenda', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $other = User::factory()->create(['role' => 'user']);

    $case = SuitCase::factory()->create([
        'title' => 'Secret Case',
        'lawyer_id' => $lawyer->id,
        'start_date' => now(),
        'status' => 'active',
    ]);

    $response = $this->actingAs($other)->getJson("/api/cases/{$case->id}/agenda");

    $response->assertStatus(403);
});
