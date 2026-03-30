<?php

namespace Database\Seeders;

use App\Models\Competencia;
use App\Models\DependenciaJudicial;
use App\Models\Jurisdiccion;
use App\Models\Radicacion;
use Illuminate\Database\Seeder;

class JudicialFederalSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Asegurar Jurisdicción Federal
        $jurisFederal = Jurisdiccion::withTrashed()->firstOrCreate(['nombre' => 'Federal']);
        if ($jurisFederal->trashed()) $jurisFederal->restore();

        // 2. Asegurar Radicación Federal
        $radFederal = Radicacion::withTrashed()->firstOrCreate(['tipo' => 'Federal']);
        if ($radFederal->trashed()) $radFederal->restore();

        // 3. Asegurar Competencias (Fueros)
        $fueros = [
            'Federal',           // Fuero general o multifuero federal
            'Penal',
            'Electoral',
            'Civil y Comercial',
        ];

        foreach ($fueros as $fuero) {
            $f = Competencia::withTrashed()->firstOrCreate(['fuero' => $fuero]);
            if ($f->trashed()) $f->restore();
        }

        $compFederal = Competencia::withTrashed()->where('fuero', 'Federal')->first();
        $compPenal = Competencia::withTrashed()->where('fuero', 'Penal')->first();
        $compElectoral = Competencia::withTrashed()->where('fuero', 'Electoral')->first();
        $compCivil = Competencia::withTrashed()->where('fuero', 'Civil y Comercial')->first();

        // 4. Dependencias Federales
        $federalDeps = [
            ['nombre' => 'Cámara Federal de Apelaciones de Paraná', 'comp' => $compFederal],
            ['nombre' => 'Tribunal Oral en lo Criminal Federal de Paraná', 'comp' => $compPenal],
            ['nombre' => 'Secretaría Electoral Nacional – Distrito Entre Ríos', 'comp' => $compElectoral],
            ['nombre' => 'Juzgado Federal de Primera Instancia de Concordia', 'comp' => $compCivil], // Multifuero
            ['nombre' => 'Juzgado Federal de Primera Instancia de Gualeguaychú', 'comp' => $compCivil], // Multifuero
            ['nombre' => 'Juzgado Federal de Primera Instancia N° 1 de Concepción del Uruguay', 'comp' => $compPenal], // Usualmente Penal
            ['nombre' => 'Juzgado Federal de Primera Instancia N° 2 de Concepción del Uruguay', 'comp' => $compCivil], // Usualmente Civil
            ['nombre' => 'Tribunal Oral en lo Criminal Federal de Concepción del Uruguay', 'comp' => $compPenal],
        ];

        foreach ($federalDeps as $dep) {
            $d = DependenciaJudicial::withTrashed()->updateOrCreate(
                [
                    'nombre_juzgado' => $dep['nombre'],
                    'jurisdiccion_id' => $jurisFederal->id,
                ],
                [
                    'radicacion_id' => $radFederal->id,
                    'competencia_id' => $dep['comp']->id,
                ]
            );
            if ($d->trashed()) $d->restore();
        }
    }
}
