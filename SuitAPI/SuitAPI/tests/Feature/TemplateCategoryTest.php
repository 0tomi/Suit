<?php

use App\Models\Template;
use App\Models\TemplateCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'admin']);
    actingAs($this->user);
});

test('can list template categories', function () {
    TemplateCategory::factory()->count(3)->create();

    getJson('/api/template-categories')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('normal user can also list template categories', function () {
    $normalUser = User::factory()->create(['role' => 'lawyer']);
    TemplateCategory::factory()->count(2)->create();

    actingAs($normalUser)
        ->getJson('/api/template-categories')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('lawyer can create template category', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $data = [
        'name' => 'Contratos',
        'description' => 'Plantillas de contratos legales',
    ];

    actingAs($lawyer)
        ->postJson('/api/template-categories', $data)
        ->assertCreated();
});

test('user role cannot create template category', function () {
    $user = User::factory()->create(['role' => 'user']);
    $data = [
        'name' => 'Categoría Prohibida',
    ];

    actingAs($user)
        ->postJson('/api/template-categories', $data)
        ->assertForbidden();
});

test('can create a template category', function () {
    $data = [
        'name' => 'Contratos',
        'description' => 'Plantillas de contratos legales',
    ];

    postJson('/api/template-categories', $data)
        ->assertCreated()
        ->assertJsonFragment($data);

    $this->assertDatabaseHas('template_categories', $data);
});

test('cannot create duplicate category name', function () {
    TemplateCategory::factory()->create(['name' => 'Contratos']);

    postJson('/api/template-categories', ['name' => 'Contratos'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);
});

test('can show a template category with templates', function () {
    $category = TemplateCategory::factory()->create();
    Template::factory()->count(2)->create(['template_category_id' => $category->id]);

    getJson("/api/template-categories/{$category->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $category->id)
        ->assertJsonCount(2, 'data.templates');
});

test('lawyer can update a template category', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $category = TemplateCategory::factory()->create();

    actingAs($lawyer)
        ->putJson("/api/template-categories/{$category->id}", ['name' => 'Actualizado'])
        ->assertOk();
});

test('can update a template category', function () {
    $category = TemplateCategory::factory()->create();

    putJson("/api/template-categories/{$category->id}", ['name' => 'Actualizado'])
        ->assertOk()
        ->assertJsonFragment(['name' => 'Actualizado']);

    $this->assertDatabaseHas('template_categories', ['id' => $category->id, 'name' => 'Actualizado']);
});

test('can update category keeping own unique name', function () {
    $category = TemplateCategory::factory()->create(['name' => 'Contratos']);

    putJson("/api/template-categories/{$category->id}", ['name' => 'Contratos', 'description' => 'Actualizado'])
        ->assertOk();
});

test('lawyer can delete a template category', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $category = TemplateCategory::factory()->create();

    actingAs($lawyer)
        ->deleteJson("/api/template-categories/{$category->id}")
        ->assertNoContent();
});

test('can delete a template category and cascades templates', function () {
    $category = TemplateCategory::factory()->create();
    $template = Template::factory()->create(['template_category_id' => $category->id]);

    deleteJson("/api/template-categories/{$category->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('template_categories', ['id' => $category->id]);
    $this->assertDatabaseMissing('templates', ['id' => $template->id]);
    $this->assertDatabaseHas('tombstones', ['resource_type' => 'template_category', 'resource_id' => $category->id]);
    $this->assertDatabaseHas('tombstones', ['resource_type' => 'template', 'resource_id' => $template->id]);
});

test('can get lightweight templates list for a category', function () {
    $category = TemplateCategory::factory()->create();
    Template::factory()->count(3)->create(['template_category_id' => $category->id]);

    $response = getJson("/api/template-categories/{$category->id}/templates-list")
        ->assertOk()
        ->assertJsonCount(3);

    // Verify lightweight structure: only id and title, no content
    $first = $response->json()[0];
    expect($first)->toHaveKeys(['id', 'title']);
    expect($first)->not->toHaveKey('content');
});

test('can get last modified date for template categories', function () {
    $date = now()->subDays(2);
    TemplateCategory::factory()->create(['updated_at' => $date]);

    getJson('/api/template-categories/last-modified')
        ->assertOk()
        ->assertJsonPath('last_modified', $date->copy()->startOfSecond()->toISOString());
});

test('default General category is immutable for admin', function () {
    $general = TemplateCategory::defaultCategory();

    putJson("/api/template-categories/{$general->id}", [
        'name' => 'General Editada',
    ])->assertForbidden()
        ->assertJsonFragment(['message' => 'La categoria de plantilla "General" es inmutable.']);

    deleteJson("/api/template-categories/{$general->id}")
        ->assertForbidden()
        ->assertJsonFragment(['message' => 'La categoria de plantilla "General" no puede ser eliminada.']);
});
