<?php

use App\Models\Agenda;
use App\Models\Event;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('prevents non-admins from registering a user', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);

    $response = $this->actingAs($lawyer)->postJson('/api/register', [
        'tag' => 'newuser',
        'name' => 'New User',
        'password' => 'password123',
        'role' => 'user',
    ]);

    $response->assertStatus(403);
});

it('allows admins to register a user', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->postJson('/api/register', [
        'tag' => 'newuser',
        'name' => 'New User',
        'password' => 'password123',
        'role' => 'user',
    ]);

    $response->assertStatus(200);
    $this->assertDatabaseHas('users', ['tag' => 'newuser']);
});

it('can get a user public profile', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create([
        'tag' => '#targetuser',
        'name' => 'Target',
    ]);

    $response = $this->actingAs($admin)->getJson("/api/users/{$user->id}");

    $response->assertStatus(200)
        ->assertJsonFragment([
            'id' => $user->id,
            'tag' => '#targetuser',
            'name' => 'Target',
        ]);
});

it('prevents non-admins from deleting a user', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $user = User::factory()->create();

    $response = $this->actingAs($lawyer)->deleteJson("/api/users/{$user->id}");

    $response->assertStatus(403);
});

it('prevents admins from deleting themselves', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $response = $this->actingAs($admin)->deleteJson("/api/users/{$admin->id}");

    $response->assertStatus(403);
});

it('soft deletes user, transfers cases, clears agenda, and frees tag', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $deletedUser = User::factory()->create([
        'role' => 'lawyer',
        'tag' => '#oldtag',
        'email' => 'old@email.com',
    ]);

    // Create a Case owned by the deletedUser
    $case = SuitCase::factory()->create(['lawyer_id' => $deletedUser->id]);

    // Create personal agenda and event
    $agenda = Agenda::create([
        'name' => 'Personal',
        'user_id' => $deletedUser->id,
        'suit_case_id' => null,
    ]);
    $event = Event::create([
        'agenda_id' => $agenda->id,
        'title' => 'Personal Event',
        'starts_at' => now()->toDateTimeString(),
    ]);

    $response = $this->actingAs($admin)->deleteJson("/api/users/{$deletedUser->id}");

    $response->assertStatus(204);

    // Assert User is soft deleted and credentials freed
    $this->assertSoftDeleted('users', [
        'id' => $deletedUser->id,
    ]);

    $trashedUser = User::withTrashed()->find($deletedUser->id);
    expect($trashedUser->tag)->toContain('del_'.$deletedUser->id.'_#oldtag');
    expect($trashedUser->email)->toContain('del_'.$deletedUser->id.'_old@email.com');

    // Assert Cases transferred
    $this->assertDatabaseHas('suit_cases', [
        'id' => $case->id,
        'lawyer_id' => $admin->id,
    ]);

    // Assert Agenda and Events deleted
    $this->assertDatabaseMissing('agendas', ['id' => $agenda->id]);
    $this->assertDatabaseMissing('events', ['id' => $event->id]);
});

it('allows admin to update user by tag', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create([
        'tag' => 'oldtag',
        'name' => 'Old Name',
    ]);

    $response = $this->actingAs($admin)->putJson("/api/users/tag/{$user->tag}", [
        'name' => 'New Name',
        'tag' => 'newtag',
    ]);

    $response->assertStatus(200);
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'New Name',
        'tag' => 'newtag',
    ]);
});

it('prevents non-admins from updating other users by tag', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $otherUser = User::factory()->create(['tag' => 'othertag']);

    $response = $this->actingAs($lawyer)->putJson("/api/users/tag/{$otherUser->tag}", [
        'name' => 'Should Not Work',
    ]);

    $response->assertStatus(403);
});

it('allows user to update themselves by tag', function () {
    $user = User::factory()->create(['tag' => 'mytag', 'name' => 'My Name']);

    $response = $this->actingAs($user)->putJson("/api/users/tag/{$user->tag}", [
        'name' => 'My New Name',
    ]);

    $response->assertStatus(200);
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'My New Name',
    ]);
});
