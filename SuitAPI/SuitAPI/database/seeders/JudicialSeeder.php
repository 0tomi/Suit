<?php

namespace Database\Seeders;

use App\Models\Competencia;
use App\Models\DependenciaJudicial;
use App\Models\Jurisdiccion;
use App\Models\Radicacion;
use Illuminate\Database\Seeder;

class JudicialSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Radicaciones
        $radicaciones = [
            'Federal',
            'Provincial',
            'Administrativo',
        ];

        foreach ($radicaciones as $tipo) {
            Radicacion::firstOrCreate(['tipo' => $tipo]);
        }

        // 2. Jurisdicciones
        $jurisdicciones = [
            'Federal',
            'Parana',
            'Concordia',
            'Gualeguaychu',
            'Concepcion del Uruguay',
            'Villaguay',
            'Victoria',
            'La Paz',
            'Colon',
            'Diamante',
            'Federacion',
            'Rosario del Tala',
            'San Jose de Feliciano',
            'Chajari',
            'Gualeguay',
            'Nogoya',
            'Islas del Ibicuy',
            'San Salvador',
        ];

        foreach ($jurisdicciones as $nombre) {
            Jurisdiccion::firstOrCreate(['nombre' => $nombre]);
        }

        // 3. Competencias
        $competencias = [
            'Civil y Comercial',
            'Laboral',
            'Familia y Niñez',
            'Penal',
            'Contencioso Administrativo',
            'Ejecuciones',
            'Paz',
            'Electoral',
            'Tributario',
        ];

        foreach ($competencias as $fuero) {
            Competencia::firstOrCreate(['fuero' => $fuero]);
        }

        // 4. Dependencias Judiciales
        $jurisFederal = Jurisdiccion::where('nombre', 'Federal')->first();
        $jurisParana = Jurisdiccion::where('nombre', 'Parana')->first();
        $jurisConcordia = Jurisdiccion::where('nombre', 'Concordia')->first();

        $compCivil = Competencia::where('fuero', 'Civil y Comercial')->first();
        $compPenal = Competencia::where('fuero', 'Penal')->first();
        $compLaboral = Competencia::where('fuero', 'Laboral')->first();
        $compFamilia = Competencia::where('fuero', 'Familia y Niñez')->first();
        $compElectoral = Competencia::where('fuero', 'Electoral')->first();

        // Federal
        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado Federal de Parana Nro 1',
            'jurisdiccion_id' => $jurisFederal->id,
            'competencia_id' => $compCivil->id, // Federal 1 holds multiple but simplified here
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado Federal de Parana Nro 2',
            'jurisdiccion_id' => $jurisFederal->id,
            'competencia_id' => $compPenal->id,
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Secretaria Electoral - Juzgado Federal 1 Paraná',
            'jurisdiccion_id' => $jurisFederal->id,
            'competencia_id' => $compElectoral->id,
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado Federal de Concordia',
            'jurisdiccion_id' => $jurisFederal->id,
            'competencia_id' => $compCivil->id,
        ]);

        // Parana Provincial
        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado de Primera Instancia Civil y Comercial Nro 1 - Parana',
            'jurisdiccion_id' => $jurisParana->id,
            'competencia_id' => $compCivil->id,
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado de Primera Instancia Civil y Comercial Nro 2 - Parana',
            'jurisdiccion_id' => $jurisParana->id,
            'competencia_id' => $compCivil->id,
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado del Trabajo Nro 1 - Parana',
            'jurisdiccion_id' => $jurisParana->id,
            'competencia_id' => $compLaboral->id,
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado de Familia Nro 1 - Parana',
            'jurisdiccion_id' => $jurisParana->id,
            'competencia_id' => $compFamilia->id,
        ]);

        // Concordia Provincial
        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado de Familia Nro 1 - Concordia',
            'jurisdiccion_id' => $jurisConcordia->id,
            'competencia_id' => $compFamilia->id,
        ]);

        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado Civil y Comercial Nro 1 - Concordia',
            'jurisdiccion_id' => $jurisConcordia->id,
            'competencia_id' => $compCivil->id,
        ]);

        // Victoria
        $jurisVictoria = Jurisdiccion::where('nombre', 'Victoria')->first();
        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado Civil y Comercial - Victoria',
            'jurisdiccion_id' => $jurisVictoria->id,
            'competencia_id' => $compCivil->id,
        ]);

        // Gualeguaychu
        $jurisGualeguaychu = Jurisdiccion::where('nombre', 'Gualeguaychu')->first();
        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado del Trabajo Nro 1 - Gualeguaychu',
            'jurisdiccion_id' => $jurisGualeguaychu->id,
            'competencia_id' => $compLaboral->id,
        ]);

        // Villaguay
        $jurisVillaguay = Jurisdiccion::where('nombre', 'Villaguay')->first();
        DependenciaJudicial::firstOrCreate([
            'nombre_juzgado' => 'Juzgado de Familia y Niñez - Villaguay',
            'jurisdiccion_id' => $jurisVillaguay->id,
            'competencia_id' => $compFamilia->id,
        ]);

        // 5. Enriquecer casos existentes
        // Assign first case to Federal
        $federalRad = Radicacion::where('tipo', 'Federal')->first();
        $federalDep = DependenciaJudicial::where('nombre_juzgado', 'Juzgado Federal de Parana Nro 1')->first();

        $provincialRad = Radicacion::where('tipo', 'Provincial')->first();
        $paranaDep = DependenciaJudicial::where('nombre_juzgado', 'Juzgado de Primera Instancia Civil y Comercial Nro 1 - Parana')->first();

        \App\Models\SuitCase::where('id', 1)->update([
            'radicacion_id' => $federalRad->id,
            'dependencia_id' => $federalDep->id,
        ]);

        \App\Models\SuitCase::where('id', 3)->update([
            'radicacion_id' => $provincialRad->id,
            'dependencia_id' => $paranaDep->id,
        ]);

        \App\Models\SuitCase::where('id', 20)->update([
            'radicacion_id' => $provincialRad->id,
            'dependencia_id' => $paranaDep->id,
        ]);
    }
}
