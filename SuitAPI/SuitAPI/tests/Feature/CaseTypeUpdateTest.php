<?php

use App\Models\CaseType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('allows admin users to update case types', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $type = CaseType::create([
        'name' => 'Civil',
        'description' => 'Descripcion original',
        'eventColor' => '#AAAAAA',
    ]);

    $this->actingAs($admin)
        ->putJson("/api/case-types/{$type->id}", [
            'name' => 'Civil actualizado',
            'description' => 'Descripcion nueva',
            'eventColor' => '#BBBBBB',
        ])
        ->assertSuccessful()
        ->assertJsonFragment([
            'id' => $type->id,
            'name' => 'Civil actualizado',
            'description' => 'Descripcion nueva',
            'eventColor' => '#BBBBBB',
        ]);

    $this->assertDatabaseHas('case_types', [
        'id' => $type->id,
        'name' => 'Civil actualizado',
        'description' => 'Descripcion nueva',
        'eventColor' => '#BBBBBB',
    ]);
});

it('forbids non admin users from updating case types', function () {
    $user = User::factory()->create(['role' => 'user']);
    $type = CaseType::create([
        'name' => 'Civil',
        'description' => 'Descripcion original',
        'eventColor' => '#AAAAAA',
    ]);

    $this->actingAs($user)
        ->putJson("/api/case-types/{$type->id}", [
            'name' => 'Civil actualizado',
            'description' => 'Descripcion nueva',
            'eventColor' => '#BBBBBB',
        ])
        ->assertForbidden();
});
