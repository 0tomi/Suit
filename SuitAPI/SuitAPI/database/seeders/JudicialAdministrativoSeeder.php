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
        $radAdmin = Radicacion::withTrashed()->firstOrCreate(['tipo' => 'Administrativo']);
        if ($radAdmin->trashed()) $radAdmin->restore();

        // 2. Asegurar Jurisdicciones
        $jurisParana = Jurisdiccion::withTrashed()->updateOrCreate(
            ['nombre' => 'Paraná'],
            ['updated_at' => now()]
        );
        if ($jurisParana->trashed()) $jurisParana->restore();

        $jurisCDU = Jurisdiccion::withTrashed()->updateOrCreate(
            ['nombre' => 'Concepción del Uruguay'],
            ['updated_at' => now()]
        );
        if ($jurisCDU->trashed()) $jurisCDU->restore();

        // 3. Asegurar Competencia Administrativo
        $compAdmin = Competencia::withTrashed()->firstOrCreate(['fuero' => 'Administrativo']);
        if ($compAdmin->trashed()) $compAdmin->restore();

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
            $d = DependenciaJudicial::withTrashed()->updateOrCreate(
                [
                    'nombre_juzgado' => $dep['nombre'],
                    'jurisdiccion_id' => $dep['juris_id'],
                ],
                [
                    'radicacion_id' => $radAdmin->id,
                    'competencia_id' => $compAdmin->id,
                ]
            );
            if ($d->trashed()) $d->restore();
        }
    }
}
