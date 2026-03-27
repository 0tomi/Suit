<?php

use App\Models\Requisito;
use App\Models\Template;
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

test('NEntidad is required and returned in template requirements', function () {
    $requisito = Requisito::factory()->create();

    $data = [
        'title' => 'Test Template',
        'content' => 'Content',
        'requirements' => [
            [
                'id_requisito' => $requisito->id,
                'id_campo' => 500,
                'NEntidad' => 2,
            ],
        ],
    ];

    $response = postJson('/api/templates', $data)
        ->assertCreated()
        ->assertJsonPath('data.requirements.0.NEntidad', 2);

    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito->id,
        'id_campo' => 500,
        'NEntidad' => 2,
    ]);
});

test('NEntidad is mandatory in template creative requests', function () {
    $requisito = Requisito::factory()->create();

    $data = [
        'title' => 'Test Template Invalid',
        'content' => 'Content',
        'requirements' => [
            [
                'id_requisito' => $requisito->id,
                'id_campo' => 500,
                // NEntidad missing
            ],
        ],
    ];

    postJson('/api/templates', $data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['requirements.0.NEntidad']);
});

test('syncUp requires NEntidad in requirements', function () {
    $requisito = Requisito::factory()->create();

    $data = [
        'templates' => [
            [
                'title' => 'Sync Template',
                'content' => 'Content',
                'requirements' => [
                    [
                        'id_requisito' => $requisito->id,
                        'id_campo' => 600,
                        'NEntidad' => 3,
                    ],
                ],
            ],
        ],
    ];

    postJson('/api/templates/sync', $data)
        ->assertOk()
        ->assertJsonPath('synced.0.requirements.0.NEntidad', 3);
});

test('templateRequirementsLastModified accounts for NEntidad updates', function () {
    $template = Template::factory()->create();
    $requisito = Requisito::factory()->create();

    // Attach requirement
    $template->requirements()->attach($requisito->id, ['id_campo' => 1, 'NEntidad' => 1]);

    $lastModifiedBefore = getJson("/api/templates/{$template->id}/requirements/last-modified")->json('last_modified');

    sleep(1); // Ensure timestamp changes

    // Update via controller (which should touch and update pivot)
    putJson("/api/templates/{$template->id}", [
        'requirements' => [
            ['id_requisito' => $requisito->id, 'id_campo' => 1, 'NEntidad' => 2],
        ],
    ])->assertOk();

    $lastModifiedAfter = getJson("/api/templates/{$template->id}/requirements/last-modified")->json('last_modified');

    expect($lastModifiedAfter)->not->toBe($lastModifiedBefore);
});

test('note field is stored and returned in template requirements', function () {
    $requisito = Requisito::factory()->create();

    $data = [
        'title' => 'Test Template with Note',
        'content' => 'Content',
        'requirements' => [
            [
                'id_requisito' => $requisito->id,
                'id_campo' => 700,
                'NEntidad' => 1,
                'note' => 'This is a test note',
            ],
        ],
    ];

    postJson('/api/templates', $data)
        ->assertCreated()
        ->assertJsonPath('data.requirements.0.note', 'This is a test note');

    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito->id,
        'id_campo' => 700,
        'note' => 'This is a test note',
    ]);
});

test('note field is not mandatory in the payload', function () {
    $requisito = Requisito::factory()->create();

    $data = [
        'title' => 'Test Template No Note',
        'content' => 'Content',
        'requirements' => [
            [
                'id_requisito' => $requisito->id,
                'id_campo' => 800,
                'NEntidad' => 1,
                // note key is missing
            ],
        ],
    ];

    postJson('/api/templates', $data)
        ->assertCreated()
        ->assertJsonPath('data.requirements.0.note', null);

    $this->assertDatabaseHas('plantilla_requisitos', [
        'requisito_id' => $requisito->id,
        'id_campo' => 800,
        'note' => null,
    ]);
});
