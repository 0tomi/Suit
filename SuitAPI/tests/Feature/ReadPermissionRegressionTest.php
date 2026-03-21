<?php

use App\Models\Honorario;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');

    // Create a lawyer who owns a case
    $this->lawyer = User::factory()->create(['role' => 'lawyer']);
    $this->suitCase = SuitCase::factory()->create(['lawyer_id' => $this->lawyer->id]);

    // Create a read-only user
    $this->readOnlyUser = User::factory()->create(['role' => 'lawyer']);
    $this->suitCase->participants()->attach($this->readOnlyUser->id, ['permission_level' => 'read']);
});

it('prevents a read-only user from creating a honorario in a case', function () {
    $client = \App\Models\Client::factory()->create();
    $this->suitCase->clients()->attach($client->id);

    $this->actingAs($this->readOnlyUser)
        ->postJson("/api/suit-cases/{$this->suitCase->id}/honorarios", [
            'monto' => 1000,
            'detalles' => 'Test Honorario',
            'client_id' => $client->id,
        ])
        ->assertStatus(403);
});

it('prevents a read-only user from updating an honorario in a case', function () {
    $client = \App\Models\Client::factory()->create();
    $honorario = Honorario::create([
        'suit_case_id' => $this->suitCase->id,
        'user_id' => $this->lawyer->id,
        'client_id' => $client->id,
        'monto' => 500,
    ]);

    $this->actingAs($this->readOnlyUser)
        ->putJson("/api/honorarios/{$honorario->id}", [
            'monto' => 2000,
        ])
        ->assertStatus(403);
});

it('prevents a read-only user from creating a gasto in a case', function () {
    $gasto = \App\Models\Gasto::create([
        'titulo' => 'Test Gasto',
        'detalles' => 'Test Details',
    ]);

    $this->actingAs($this->readOnlyUser)
        ->postJson("/api/suit-cases/{$this->suitCase->id}/gastos", [
            'monto' => 500,
            'detalles' => 'Test Gasto Entry',
            'gasto_id' => $gasto->id,
        ])
        ->assertStatus(403);
});

it('prevents a read-only user from uploading a file to a case', function () {
    $file = UploadedFile::fake()->create('document.pdf', 100);

    $this->actingAs($this->readOnlyUser)
        ->postJson('/api/files', [
            'suit_case_id' => $this->suitCase->id,
            'file' => $file,
            'title' => 'Test File',
        ])
        ->assertStatus(403);
});

it('prevents a read-only user from uploading multimedia to a case', function () {
    $file = UploadedFile::fake()->image('photo.jpg');

    $this->actingAs($this->readOnlyUser)
        ->postJson('/api/multimedia', [
            'suit_case_id' => $this->suitCase->id,
            'file' => $file,
            'title' => 'Test Image',
        ])
        ->assertStatus(403);
});
