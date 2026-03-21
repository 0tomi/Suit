<?php

use App\Models\PublicFileCatalog;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->user = User::factory()->create(['role' => 'user']);

    // Create the "General" catalog through the seeder or manually
    $this->generalCatalog = PublicFileCatalog::create([
        'name' => 'General',
        'description' => 'Default catalog',
    ]);
});

it('prevents any user (including admin) from deleting the General catalog', function () {
    actingAs($this->admin)
        ->deleteJson("/api/public-file-catalogs/{$this->generalCatalog->id}")
        ->assertForbidden();

    assertDatabaseHas('public_file_catalogs', ['id' => $this->generalCatalog->id, 'name' => 'General']);
});

it('prevents any user (including admin) from updating the General catalog', function () {
    actingAs($this->admin)
        ->putJson("/api/public-file-catalogs/{$this->generalCatalog->id}", [
            'name' => 'New Name',
        ])
        ->assertForbidden();

    assertDatabaseHas('public_file_catalogs', ['id' => $this->generalCatalog->id, 'name' => 'General']);
});

it('allows admin to create other catalogs', function () {
    actingAs($this->admin)
        ->postJson('/api/public-file-catalogs', [
            'name' => 'New Catalog',
            'description' => 'Test description',
        ])
        ->assertCreated();

    assertDatabaseHas('public_file_catalogs', ['name' => 'New Catalog']);
});

it('allows admin to update other catalogs', function () {
    $catalog = PublicFileCatalog::create(['name' => 'Editable Catalog']);

    actingAs($this->admin)
        ->putJson("/api/public-file-catalogs/{$catalog->id}", [
            'name' => 'Updated Catalog',
        ])
        ->assertSuccessful();

    assertDatabaseHas('public_file_catalogs', ['id' => $catalog->id, 'name' => 'Updated Catalog']);
});

it('allows admin to delete other catalogs', function () {
    $catalog = PublicFileCatalog::create(['name' => 'Deletable Catalog']);

    actingAs($this->admin)
        ->deleteJson("/api/public-file-catalogs/{$catalog->id}")
        ->assertNoContent();

    assertDatabaseMissing('public_file_catalogs', ['id' => $catalog->id]);
});
