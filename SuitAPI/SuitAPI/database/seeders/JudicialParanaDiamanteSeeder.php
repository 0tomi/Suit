<?php

namespace Database\Seeders;

use App\Models\Competencia;
use App\Models\DependenciaJudicial;
use App\Models\Jurisdiccion;
use App\Models\Radicacion;
use Illuminate\Database\Seeder;

class JudicialParanaDiamanteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Asegurar Jurisdicciones (Paraná y Diamante)
        $jurisParana = Jurisdiccion::updateOrCreate(
            ['nombre' => 'Paraná'],
            ['updated_at' => now()]
        );

        $jurisDiamante = Jurisdiccion::updateOrCreate(
            ['nombre' => 'Diamante'],
            ['updated_at' => now()]
        );

        // 2. Asegurar Radicación Provincial
        $radProvincial = Radicacion::firstOrCreate(['tipo' => 'Provincial']);

        // 3. Asegurar Competencias (Fueros)
        // Agregamos las que falten según el análisis del listado
        $fueros = [
            'Civil y Comercial',
            'Laboral',
            'Familia y Niñez',
            'Penal',
            'Contencioso Administrativo',
            'Ejecuciones',
            'Paz',
            'Ministerio Público', // Nueva para Fiscalías y Defensorías
            'Médico / Pericial',   // Nueva para Médico de Tribunales
        ];

        foreach ($fueros as $fuero) {
            Competencia::firstOrCreate(['fuero' => $fuero]);
        }

        $compCivil = Competencia::where('fuero', 'Civil y Comercial')->first();
        $compLaboral = Competencia::where('fuero', 'Laboral')->first();
        $compFamilia = Competencia::where('fuero', 'Familia y Niñez')->first();
        $compPenal = Competencia::where('fuero', 'Penal')->first();
        $compCA = Competencia::where('fuero', 'Contencioso Administrativo')->first();
        $compEjec = Competencia::where('fuero', 'Ejecuciones')->first();
        $compPaz = Competencia::where('fuero', 'Paz')->first();
        $compMP = Competencia::where('fuero', 'Ministerio Público')->first();
        $compMed = Competencia::where('fuero', 'Médico / Pericial')->first();

        // 4. Dependencias de Paraná
        $paranaDeps = [
            ['nombre' => 'Tribunal de Juicio y Apelaciones', 'comp' => $compPenal],
            ['nombre' => 'Cámara de Casación Penal', 'comp' => $compPenal],
            ['nombre' => 'Colegio de Jueces y Juezas de Garantías', 'comp' => $compPenal],
            ['nombre' => 'Juez Penal de Niños, Niñas y Adolescentes', 'comp' => $compFamilia],
            ['nombre' => 'Jueza de Ejecución de Penas y Medidas de Seguridad', 'comp' => $compPenal],
            ['nombre' => 'Oficina Provincial de Coordinación y Control de Gestión de OGAs', 'comp' => $compPenal],
            ['nombre' => 'Oficina de Gestión de Audiencias (OGA)', 'comp' => $compPenal],
            ['nombre' => 'Oficina de Medios Alternativos (OMA)', 'comp' => $compPenal],
            ['nombre' => 'Cámara Segunda Civil y Comercial', 'comp' => $compCivil],
            ['nombre' => 'Cámara Tercera Laboral', 'comp' => $compLaboral],
            ['nombre' => 'Cámara en lo Contencioso Administrativo', 'comp' => $compCA],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 1', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 2', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 3', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 4', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 5', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 6', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 7', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 9 – Concursos y Quiebras', 'comp' => $compCivil],
            ['nombre' => 'Juzgado en lo Civil y Comercial N° 10 – Procesos de Ejecución', 'comp' => $compEjec],
            ['nombre' => 'Juzgado del Trabajo N° 1', 'comp' => $compLaboral],
            ['nombre' => 'Juzgado del Trabajo N° 2', 'comp' => $compLaboral],
            ['nombre' => 'Juzgado del Trabajo N° 3', 'comp' => $compLaboral],
            ['nombre' => 'Juzgado del Trabajo N° 4', 'comp' => $compLaboral],
            ['nombre' => 'Juzgado de Familia N° 1', 'comp' => $compFamilia],
            ['nombre' => 'Juzgado de Familia N° 2', 'comp' => $compFamilia],
            ['nombre' => 'Juzgado de Familia N° 3', 'comp' => $compFamilia],
            ['nombre' => 'Juzgado de Familia N° 4', 'comp' => $compFamilia],
            ['nombre' => 'Juzgado de Familia N° 5', 'comp' => $compFamilia],
            ['nombre' => 'Oficina Gestión Única (OGU)', 'comp' => $compFamilia],
            ['nombre' => 'Juzgado de Paz – 1era. Categoría N° 1', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 1era. Categoría N° 2', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de Crespo', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de Cerrito', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de Hasenkamp', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de Hernandarias', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de María Grande', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de San Benito', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. Categoría de Viale', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 3era. Categoría de Oro Verde', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 3era. Categoría de Pueblo Brugo', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 3era. Categoría de Seguí', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 3era. Categoría de Villa Urquiza', 'comp' => $compPaz],
            ['nombre' => 'Ministerio Público Fiscal', 'comp' => $compMP],
            ['nombre' => 'Ministerio Público de la Defensa', 'comp' => $compMP],
        ];

        foreach ($paranaDeps as $dep) {
            DependenciaJudicial::firstOrCreate([
                'nombre_juzgado' => $dep['nombre'],
                'jurisdiccion_id' => $jurisParana->id,
                'radicacion_id' => $radProvincial->id,
                'competencia_id' => $dep['comp']->id,
            ]);
        }

        // 5. Dependencias de Diamante
        $diamanteDeps = [
            ['nombre' => 'Juez de Garantía y Transición', 'comp' => $compPenal],
            ['nombre' => 'Juzgado Civil y Comercial', 'comp' => $compCivil],
            ['nombre' => 'Juzgado de Familia y Penal de Niños, Niñas y Adolescentes', 'comp' => $compFamilia],
            ['nombre' => 'OGU Familia', 'comp' => $compFamilia],
            ['nombre' => 'Juzgado de Paz – 1era. categoría de Diamante', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. categoría de General Ramírez', 'comp' => $compPaz],
            ['nombre' => 'Juzgado de Paz – 2da. categoría de Villa Libertador General San Martín', 'comp' => $compPaz],
            ['nombre' => 'Unidad Fiscal', 'comp' => $compMP],
            ['nombre' => 'Defensoría de Pobres y Menores', 'comp' => $compMP],
            ['nombre' => 'Médico de Tribunales', 'comp' => $compMed],
        ];

        foreach ($diamanteDeps as $dep) {
            DependenciaJudicial::firstOrCreate([
                'nombre_juzgado' => $dep['nombre'],
                'jurisdiccion_id' => $jurisDiamante->id,
                'radicacion_id' => $radProvincial->id,
                'competencia_id' => $dep['comp']->id,
            ]);
        }
    }
}
