<?php

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();

    // Create 3 documents with different names and timestamps
    $this->docA = Document::factory()->create([
        'name' => 'Alpha',
        'user_id' => $this->user->id,
        'suit_case_id' => null,
        'created_at' => now()->subDays(3),
        'updated_at' => now()->subDays(1),
    ]);

    $this->docB = Document::factory()->create([
        'name' => 'Gamma',
        'user_id' => $this->user->id,
        'suit_case_id' => null,
        'created_at' => now()->subDays(2),
        'updated_at' => now()->subDays(3),
    ]);

    $this->docC = Document::factory()->create([
        'name' => 'Beta',
        'user_id' => $this->user->id,
        'suit_case_id' => null,
        'created_at' => now()->subDays(1),
        'updated_at' => now()->subDays(2),
    ]);
});

test('documents index sorts by updated_at desc by default', function () {
    $response = $this->actingAs($this->user)->getJson('/api/documents');

    $response->assertStatus(200);
    $data = $response->json('data');

    // Expected order: Alpha (now-1), Beta (now-2), Gamma (now-3)
    expect($data[0]['id'])->toBe($this->docA->id);
    expect($data[1]['id'])->toBe($this->docC->id);
    expect($data[2]['id'])->toBe($this->docB->id);
});

test('documents index can sort by name asc', function () {
    $response = $this->actingAs($this->user)->getJson('/api/documents?sort_by=name&sort_direction=asc');

    $response->assertStatus(200);
    $data = $response->json('data');

    // Alpha, Beta, Gamma
    expect($data[0]['name'])->toBe('Alpha');
    expect($data[1]['name'])->toBe('Beta');
    expect($data[2]['name'])->toBe('Gamma');
});

test('documents paged-filtered can sort by created_at desc', function () {
    $response = $this->actingAs($this->user)->getJson('/api/documents/paged-filtered?sort_by=created_at&sort_direction=desc');

    $response->assertStatus(200);
    $data = $response->json('data');

    // Expected: Beta (now-1), Gamma (now-2), Alpha (now-3)
    expect($data[0]['id'])->toBe($this->docC->id);
    expect($data[1]['id'])->toBe($this->docB->id);
    expect($data[2]['id'])->toBe($this->docA->id);
});

test('documents search can sort by name desc', function () {
    $response = $this->actingAs($this->user)->getJson('/api/documents/search?search=a&sort_by=name&sort_direction=desc');

    $response->assertStatus(200);
    $data = $response->json();

    // All Docs have 'a' in their name (Alpha, Gamma, Beta)
    // Sorted by name desc: Gamma, Beta, Alpha
    expect($data[0]['name'])->toBe('Gamma');
    expect($data[1]['name'])->toBe('Beta');
    expect($data[2]['name'])->toBe('Alpha');
});
