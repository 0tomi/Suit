<?php

use App\Models\Parte;
use App\Models\Rol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'admin']);
    $this->rol = Rol::factory()->create();
    $this->actingAs($this->user);
});

test('can get partes last modified', function () {
    Parte::factory()->create(['updated_at' => now()->subDay()]);
    $latest = Parte::factory()->create(['updated_at' => now()]);

    $response = $this->getJson('/api/partes/last-modified');

    $response->assertStatus(200)
        ->assertJsonStructure(['last_modified'])
        ->assertJsonFragment(['last_modified' => Carbon::parse($latest->updated_at)->toJSON()]);
});

test('can sync down partes', function () {
    $oldParte = Parte::factory()->create(['updated_at' => now()->subDays(2)]);
    $newParte = Parte::factory()->create(['updated_at' => now()]);
    $deletedParte = Parte::factory()->create(['updated_at' => now()]);
    $deletedParte->delete();

    $since = now()->subDay()->toDateTimeString();
    $response = $this->getJson("/api/partes/sync?since={$since}");

    $response->assertStatus(200);

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($newParte->id)
        ->toContain($deletedParte->id)
        ->not->toContain($oldParte->id);
});
