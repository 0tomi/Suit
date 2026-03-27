<?php

use App\Models\CaseType;
use App\Models\Competencia;
use App\Models\DependenciaJudicial;
use App\Models\Jurisdiccion;
use App\Models\Radicacion;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('can create judicial structure and link to suitcase', function () {
    $jurisdiccion = Jurisdiccion::factory()->create(['nombre' => 'Diamante']);
    $competencia = Competencia::factory()->create(['fuero' => 'Familia']);

    $dependencia = DependenciaJudicial::factory()->create([
        'jurisdiccion_id' => $jurisdiccion->id,
        'competencia_id' => $competencia->id,
        'nombre_juzgado' => 'Juzgado de Familia N° 1 de Diamante',
    ]);

    $radicacion = Radicacion::factory()->create(['tipo' => 'Provincial']);

    $user = User::factory()->create(['role' => 'lawyer']);
    $caseType = CaseType::factory()->create();

    $suitcase = SuitCase::factory()->create([
        'lawyer_id' => $user->id,
        'case_type_id' => $caseType->id,
        'radicacion_id' => $radicacion->id,
        'dependencia_id' => $dependencia->id,
    ]);

    expect($suitcase->dependenciaJudicial->id)->toBe($dependencia->id);
    expect($suitcase->dependenciaJudicial->jurisdiccion->nombre)->toBe('Diamante');
    expect($suitcase->dependenciaJudicial->competencia->fuero)->toBe('Familia');
    expect($suitcase->radicacion->tipo)->toBe('Provincial');
});

test('jurisdiccion can return its competencies', function () {
    $jurisdiccion = Jurisdiccion::factory()->create();
    $comp1 = Competencia::factory()->create(['fuero' => 'Familia']);
    $comp2 = Competencia::factory()->create(['fuero' => 'Penal']);

    DependenciaJudicial::factory()->create([
        'jurisdiccion_id' => $jurisdiccion->id,
        'competencia_id' => $comp1->id,
    ]);

    DependenciaJudicial::factory()->create([
        'jurisdiccion_id' => $jurisdiccion->id,
        'competencia_id' => $comp2->id,
    ]);

    // Same competence, different dependency (should be unique in helper)
    DependenciaJudicial::factory()->create([
        'jurisdiccion_id' => $jurisdiccion->id,
        'competencia_id' => $comp1->id,
        'nombre_juzgado' => 'Another Juzgado',
    ]);

    $competencias = $jurisdiccion->competencias;

    expect($competencias)->toHaveCount(2);
    expect($competencias->pluck('fuero'))->toContain('Familia', 'Penal');
});

test('dependencia_id is nullable in suitcase', function () {
    $radicacion = Radicacion::factory()->create(['tipo' => 'Federal']);
    $user = User::factory()->create(['role' => 'lawyer']);
    $caseType = CaseType::factory()->create();

    $suitcase = SuitCase::factory()->create([
        'lawyer_id' => $user->id,
        'case_type_id' => $caseType->id,
        'radicacion_id' => $radicacion->id,
        'dependencia_id' => null,
    ]);

    expect($suitcase->dependencia_id)->toBeNull();
});

test('on delete check: dependency deletion sets suitcase fk to null', function () {
    $dependencia = DependenciaJudicial::factory()->create();
    $radicacion = Radicacion::factory()->create();
    $user = User::factory()->create(['role' => 'lawyer']);
    $caseType = CaseType::factory()->create();

    $suitcase = SuitCase::factory()->create([
        'lawyer_id' => $user->id,
        'case_type_id' => $caseType->id,
        'radicacion_id' => $radicacion->id,
        'dependencia_id' => $dependencia->id,
    ]);

    expect($suitcase->dependencia_id)->toBe($dependencia->id);

    $dependencia->delete(); // This is soft delete by default, let's force real delete for testing FK or check if soft delete affects FK (it shouldn't automatically set to null unless force deleted)

    // SQLite with FK enabled is needed, but Laravel usually handles the logic if specified in migration
    $dependencia->forceDelete();

    $suitcase->refresh();
    expect($suitcase->dependencia_id)->toBeNull();
});
