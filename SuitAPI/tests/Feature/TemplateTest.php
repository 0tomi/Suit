<?php

use App\Models\Template;
use App\Models\TemplateCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    actingAs($this->user);
});

test('can list templates without content', function () {
    Template::factory()->count(3)->create();

    $response = getJson('/api/templates')
        ->assertOk()
        ->assertJsonCount(3, 'data');

    $first = $response->json('data')[0];
    expect($first)->toHaveKeys(['id', 'title', 'template_category_id']);
    expect($first)->not->toHaveKey('content');
    expect($first)->not->toHaveKey('category');
});

test('can create a template', function () {
    $category = TemplateCategory::factory()->create();

    $data = [
        'template_category_id' => $category->id,
        'title' => 'Contrato de Alquiler',
        'content' => '<h1>Contrato</h1><p>Entre {{nombre_cliente}} y {{nombre_propietario}}</p>',
    ];

    postJson('/api/templates', $data)
        ->assertCreated()
        ->assertJsonFragment(['title' => 'Contrato de Alquiler']);

    $this->assertDatabaseHas('templates', ['title' => 'Contrato de Alquiler']);
});

test('validates required fields on create', function () {
    postJson('/api/templates', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'content']);
});

test('validates category exists on create', function () {
    postJson('/api/templates', [
        'template_category_id' => 999,
        'title' => 'Test',
        'content' => 'Content',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['template_category_id']);
});

test('can show a template with category', function () {
    $template = Template::factory()->create();

    getJson("/api/templates/{$template->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $template->id)
        ->assertJsonPath('data.category.id', $template->template_category_id);
});

test('can update a template', function () {
    $template = Template::factory()->create();

    putJson("/api/templates/{$template->id}", ['title' => 'Titulo Actualizado'])
        ->assertOk()
        ->assertJsonFragment(['title' => 'Titulo Actualizado']);

    $this->assertDatabaseHas('templates', ['id' => $template->id, 'title' => 'Titulo Actualizado']);
});

test('lawyer can delete a template', function () {
    $lawyer = User::factory()->create(['role' => 'lawyer']);
    $template = Template::factory()->create();

    actingAs($lawyer)
        ->deleteJson("/api/templates/{$template->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('templates', ['id' => $template->id]);
    $this->assertDatabaseHas('tombstones', ['resource_type' => 'template', 'resource_id' => $template->id]);
});

test('admin can delete a template', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $template = Template::factory()->create();

    actingAs($admin)
        ->deleteJson("/api/templates/{$template->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('templates', ['id' => $template->id]);
    $this->assertDatabaseHas('tombstones', ['resource_type' => 'template', 'resource_id' => $template->id]);
});

test('normal user cannot delete a template', function () {
    $user = User::factory()->create(['role' => 'user']);
    $template = Template::factory()->create();

    actingAs($user)
        ->deleteJson("/api/templates/{$template->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('templates', ['id' => $template->id]);
});

test('can get last modified date for templates', function () {
    $date = now()->subDays(2);
    Template::factory()->create(['updated_at' => $date]);

    getJson('/api/templates/last-modified')
        ->assertOk()
        ->assertJsonPath('last_modified', $date->copy()->startOfSecond()->toISOString());
});

test('uses General as default category when template_category_id is omitted', function () {
    $response = postJson('/api/templates', [
        'title' => 'Default category template',
        'content' => '<p>Body</p>',
    ])->assertCreated();

    $general = TemplateCategory::where('name', TemplateCategory::DEFAULT_NAME)->firstOrFail();

    expect($response->json('data.template_category_id'))->toBe($general->id);
});

test('uses General as default category when template_category_id is null', function () {
    $response = postJson('/api/templates', [
        'template_category_id' => null,
        'title' => 'Default category template null',
        'content' => '<p>Body</p>',
    ])->assertCreated();

    $general = TemplateCategory::where('name', TemplateCategory::DEFAULT_NAME)->firstOrFail();

    expect($response->json('data.template_category_id'))->toBe($general->id);
});
