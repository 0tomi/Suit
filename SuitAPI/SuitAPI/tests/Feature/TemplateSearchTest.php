<?php

use App\Models\Template;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

test('it returns templates ordered by most recent', function () {
    $t1 = Template::factory()->create(['created_at' => now()->subDay()]);
    $t2 = Template::factory()->create(['created_at' => now()]);

    $response = $this->getJson('/api/templates');

    $response->assertStatus(200);
    $response->assertJsonPath('data.0.id', $t2->id);
    $response->assertJsonPath('data.1.id', $t1->id);
});

test('it searches templates by title', function () {
    Template::factory()->create(['title' => 'Common Title']);
    $target = Template::factory()->create(['title' => 'Unique Search Term']);

    $response = $this->getJson('/api/templates/search?q=Unique');

    $response->assertStatus(200);
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.id', $target->id);
});

test('it searches templates by content', function () {
    Template::factory()->create(['content' => 'Regular content']);
    $target = Template::factory()->create(['content' => 'Hidden treasure here']);

    $response = $this->getJson('/api/templates/search?q=treasure');

    $response->assertStatus(200);
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.id', $target->id);
});

test('it paginates search results by 10', function () {
    Template::factory()->count(15)->create(['title' => 'Searchable Template']);

    $response = $this->getJson('/api/templates/search?q=Searchable');

    $response->assertStatus(200);
    $response->assertJsonCount(10, 'data');
    $response->assertJsonPath('meta.per_page', 10);
    $response->assertJsonPath('meta.total', 15);
});

test('it requires a search query', function () {
    $response = $this->getJson('/api/templates/search');

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['q']);
});
