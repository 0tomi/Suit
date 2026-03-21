<?php

use App\Models\CaseType;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('only lawyers and admins can list cases', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']); // Correct role

    $this->actingAs($lawyer)->getJson('/api/cases')->assertStatus(200);
    $this->actingAs($admin)->getJson('/api/cases')->assertStatus(200);
    $this->actingAs($user)->getJson('/api/cases')->assertStatus(403);
});

test('user can view a case if they are the owner', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::factory()->create(['name' => 'Civil']);
    $case = SuitCase::factory()->create([
        'title' => 'My Case',
        'lawyer_id' => $lawyer->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);

    $this->actingAs($lawyer)->getJson("/api/cases/{$case->id}")->assertStatus(200);
});

test('user can view a case if they are a participant', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::factory()->create(['name' => 'Civil']);
    $case = SuitCase::factory()->create([
        'title' => 'Shared Case',
        'lawyer_id' => $owner->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);

    $case->participants()->attach($participant->id, ['permission_level' => 'read']);

    $this->actingAs($participant)->getJson("/api/cases/{$case->id}")->assertStatus(200);
});

test('user cannot view a case if they are not owner or participant', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $other = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::factory()->create(['name' => 'Civil']);
    $case = SuitCase::factory()->create([
        'title' => 'Private Case',
        'lawyer_id' => $owner->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);

    $this->actingAs($other)->getJson("/api/cases/{$case->id}")->assertStatus(403);
});

test('admin can view and update any case', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $admin = User::factory()->create(['role' => 'admin']);
    $type = CaseType::factory()->create(['name' => 'Civil']);
    $case = SuitCase::factory()->create([
        'title' => 'Private Case',
        'lawyer_id' => $owner->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);

    $this->actingAs($admin)->getJson("/api/cases/{$case->id}")->assertOk();

    $this->actingAs($admin)->putJson("/api/cases/{$case->id}", [
        'title' => 'Admin Updated',
        'nro_expediente' => $case->nro_expediente,
        'radicacion_id' => $case->radicacion_id,
    ])->assertOk()
        ->assertJsonFragment(['title' => 'Admin Updated']);
});

test('admin can list all cases', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $ownerA = User::factory()->create(['role' => 'lawyer']);
    $ownerB = User::factory()->create(['role' => 'lawyer']);
    $type = CaseType::create(['name' => 'Civil']);

    SuitCase::factory()->create([
        'title' => 'Case A',
        'lawyer_id' => $ownerA->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);
    SuitCase::factory()->create([
        'title' => 'Case B',
        'lawyer_id' => $ownerB->id,
        'case_type_id' => $type->id,
        'status' => 'closed',
        'start_date' => '2023-01-02',
    ]);

    $this->actingAs($admin)->getJson('/api/cases')
        ->assertOk()
        ->assertJsonCount(2);
});

test('only admin can delete a case', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);
    $admin = User::factory()->create(['role' => 'admin']);
    $type = CaseType::factory()->create(['name' => 'Civil']);
    $case = SuitCase::factory()->create([
        'title' => 'Delete Test',
        'lawyer_id' => $owner->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);

    $case->participants()->attach($participant->id, ['permission_level' => 'write']);

    $this->actingAs($participant)->deleteJson("/api/cases/{$case->id}")->assertStatus(403);
    $this->actingAs($owner)->deleteJson("/api/cases/{$case->id}")->assertStatus(403);
    $this->actingAs($admin)->deleteJson("/api/cases/{$case->id}")->assertStatus(204);

    $this->assertSoftDeleted('suit_cases', ['id' => $case->id]);
});

test('only lawyers and admins can create a case', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);
    $type = CaseType::create(['name' => 'Civil']);

    $radicacion = \App\Models\Radicacion::factory()->create();
    $caseData = [
        'title' => 'New Case',
        'case_type_id' => $type->id,
        'start_date' => '2023-01-01',
        'nro_expediente' => 'EXP-123',
        'radicacion_id' => $radicacion->id,
    ];

    $this->actingAs($user)->postJson('/api/cases', $caseData)->assertStatus(403);
    $this->actingAs($lawyer)->postJson('/api/cases', $caseData)->assertStatus(201);

    $caseData['title'] = 'Admin Case';
    $this->actingAs($admin)->postJson('/api/cases', $caseData)->assertStatus(201);
});

test('only owner and admin can close a case', function () {
    $owner = User::factory()->create(['role' => 'lawyer']);
    $participant = User::factory()->create(['role' => 'lawyer']);
    $admin = User::factory()->create(['role' => 'admin']);
    $type = CaseType::factory()->create(['name' => 'Civil']);
    $case = SuitCase::factory()->create([
        'title' => 'Close Test',
        'lawyer_id' => $owner->id,
        'case_type_id' => $type->id,
        'status' => 'active',
        'start_date' => '2023-01-01',
    ]);

    $case->participants()->attach($participant->id, ['permission_level' => 'write']);

    // Participant cannot close
    $this->actingAs($participant)->postJson("/api/cases/{$case->id}/close")->assertStatus(403);

    // Admin can close
    $this->actingAs($admin)->postJson("/api/cases/{$case->id}/close")->assertStatus(200);
    expect($case->fresh()->status)->toBe('closed');

    // Reopen manually for owner test
    $case->update(['status' => 'active', 'end_date' => null]);

    // Owner can close
    $this->actingAs($owner)->postJson("/api/cases/{$case->id}/close")->assertStatus(200);
    expect($case->fresh()->status)->toBe('closed');
});
