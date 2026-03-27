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
        $jurisFederal = Jurisdiccion::firstOrCreate(['nombre' => 'Federal']);

        // 2. Asegurar Radicación Federal
        $radFederal = Radicacion::firstOrCreate(['tipo' => 'Federal']);

        // 3. Asegurar Competencias (Fueros)
        $fueros = [
            'Federal',           // Fuero general o multifuero federal
            'Penal',
            'Electoral',
            'Civil y Comercial',
        ];

        foreach ($fueros as $fuero) {
            Competencia::firstOrCreate(['fuero' => $fuero]);
        }

        $compFederal = Competencia::where('fuero', 'Federal')->first();
        $compPenal = Competencia::where('fuero', 'Penal')->first();
        $compElectoral = Competencia::where('fuero', 'Electoral')->first();
        $compCivil = Competencia::where('fuero', 'Civil y Comercial')->first();

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
            DependenciaJudicial::firstOrCreate([
                'nombre_juzgado' => $dep['nombre'],
                'jurisdiccion_id' => $jurisFederal->id,
                'radicacion_id' => $radFederal->id,
                'competencia_id' => $dep['comp']->id,
            ]);
        }
    }
}
