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

test('can create a template with requirements', function () {
    $category = TemplateCategory::factory()->create();
    $requisito1 = \App\Models\Requisito::factory()->create(['title' => 'Nombre Cliente']);
    $requisito2 = \App\Models\Requisito::factory()->create(['title' => 'DNI Cliente']);

    $data = [
        'template_category_id' => $category->id,
        'title' => 'Template con Requisitos',
        'content' => 'Content...',
        'requirements' => [
            ['id_requisito' => $requisito1->id, 'id_campo' => 101, 'NEntidad' => 1],
            ['id_requisito' => $requisito2->id, 'id_campo' => 102, 'NEntidad' => 1],
        ],
    ];

    $response = postJson('/api/templates', $data)
        ->assertCreated()
        ->assertJsonCount(2, 'data.requirements');

    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito1->id,
        'id_campo' => 101,
    ]);
    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito2->id,
        'id_campo' => 102,
    ]);
});

test('can sync up multiple templates with requirements', function () {
    $category = TemplateCategory::factory()->create();
    $requisito = \App\Models\Requisito::factory()->create();

    $data = [
        'templates' => [
            [
                'title' => 'Sync Template 1',
                'content' => 'Content 1',
                'template_category_id' => $category->id,
                'requirements' => [
                    ['id_requisito' => $requisito->id, 'id_campo' => 201, 'NEntidad' => 1],
                ],
            ],
            [
                'title' => 'Sync Template 2',
                'content' => 'Content 2',
                'template_category_id' => $category->id,
                'requirements' => [
                    ['id_requisito' => $requisito->id, 'id_campo' => 202, 'NEntidad' => 1],
                ],
            ],
        ],
    ];

    postJson('/api/templates/sync', $data)
        ->assertOk()
        ->assertJsonCount(2, 'synced');

    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito->id,
        'id_campo' => 201,
    ]);
    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito->id,
        'id_campo' => 202,
    ]);
});

test('can update a template with requirements', function () {
    $template = Template::factory()->create();
    $requisito = \App\Models\Requisito::factory()->create();

    $data = [
        'title' => 'Updated Title',
        'requirements' => [
            ['id_requisito' => $requisito->id, 'id_campo' => 301, 'NEntidad' => 1],
        ],
    ];

    putJson("/api/templates/{$template->id}", $data)
        ->assertOk()
        ->assertJsonCount(1, 'data.requirements');

    $this->assertDatabaseHas('plantilla_requisitos', [
        'template_id' => $template->id,
        'requisito_id' => $requisito->id,
        'id_campo' => 301,
    ]);
});
