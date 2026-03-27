<?php

namespace Database\Seeders;

use App\Models\Competencia;
use App\Models\DependenciaJudicial;
use App\Models\Jurisdiccion;
use App\Models\Radicacion;
use Illuminate\Database\Seeder;

class JudicialAdministrativoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Asegurar Radicación Administrativo
        $radAdmin = Radicacion::firstOrCreate(['tipo' => 'Administrativo']);

        // 2. Asegurar Jurisdicciones
        $jurisParana = Jurisdiccion::updateOrCreate(
            ['nombre' => 'Paraná'],
            ['updated_at' => now()]
        );

        $jurisCDU = Jurisdiccion::updateOrCreate(
            ['nombre' => 'Concepción del Uruguay'],
            ['updated_at' => now()]
        );

        // 3. Asegurar Competencia Administrativo
        $compAdmin = Competencia::firstOrCreate(['fuero' => 'Administrativo']);

        // 4. Dependencias Administrativas
        $adminDeps = [
            [
                'nombre' => 'Cámara en lo Contencioso Administrativo N.º 1 de Paraná',
                'juris_id' => $jurisParana->id,
            ],
            [
                'nombre' => 'Cámara en lo Contencioso Administrativo N.º 2 de Concepción del Uruguay',
                'juris_id' => $jurisCDU->id,
            ],
        ];

        foreach ($adminDeps as $dep) {
            DependenciaJudicial::firstOrCreate([
                'nombre_juzgado' => $dep['nombre'],
                'jurisdiccion_id' => $dep['juris_id'],
                'radicacion_id' => $radAdmin->id,
                'competencia_id' => $compAdmin->id,
            ]);
        }
    }
}
