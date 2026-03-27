<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class TipoExpedienteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tiposPorCategoria = [
            'Penal' => [
                ['titulo' => 'Homicidio'],
                ['titulo' => 'Lesiones'],
                ['titulo' => 'Amenazas'],
                ['titulo' => 'Robo'],
                ['titulo' => 'Hurto'],
                ['titulo' => 'Estafa'],
                ['titulo' => 'Usurpación'],
                ['titulo' => 'Daños'],
                ['titulo' => 'Abuso sexual'],
                ['titulo' => 'Grooming'],
                ['titulo' => 'Violencia de género'],
                ['titulo' => 'Tenencia de estupefacientes'],
                ['titulo' => 'Trata de personas'],
                ['titulo' => 'Falsificación de documento'],
                ['titulo' => 'Lavado de activos'],
                ['titulo' => 'Cohecho'],
                ['titulo' => 'Malversación'],
                ['titulo' => 'Encubrimiento'],
            ],
            'Civil' => [
                ['titulo' => 'Daños y perjuicios'],
                ['titulo' => 'Cobro de pesos'],
                ['titulo' => 'Cumplimiento de contrato'],
                ['titulo' => 'Desalojo'],
                ['titulo' => 'Usucapión'],
                ['titulo' => 'Sucesión ab intestato'],
                ['titulo' => 'Sucesión testamentaria'],
                ['titulo' => 'Ejecución de pagaré'],
            ],
            'Familia' => [
                ['titulo' => 'Divorcio'],
                ['titulo' => 'Alimentos'],
                ['titulo' => 'Cuidado personal'],
                ['titulo' => 'Régimen de comunicación'],
                ['titulo' => 'Filiación'],
                ['titulo' => 'Adopción'],
                ['titulo' => 'Violencia familiar'],
            ],
            'Laboral' => [
                ['titulo' => 'Despido'],
                ['titulo' => 'Diferencias salariales'],
                ['titulo' => 'Accidente de trabajo'],
                ['titulo' => 'Enfermedad profesional'],
                ['titulo' => 'Registración deficiente'],
            ],
            'Comercial' => [
                ['titulo' => 'Ejecución de cheque'],
                ['titulo' => 'Concurso preventivo'],
                ['titulo' => 'Quiebra'],
                ['titulo' => 'Conflicto societario'],
                ['titulo' => 'Rendición de cuentas'],
            ],
            'Administrativo' => [
                ['titulo' => 'Nulidad de acto administrativo'],
                ['titulo' => 'Amparo por mora'],
                ['titulo' => 'Reclamo contra el Estado'],
                ['titulo' => 'Empleo público'],
                ['titulo' => 'Multa administrativa'],
            ],
        ];

        // Procedimientos Generales opcionales (opcional: podrías quitarlos si quieres limpieza total)
        $procedimientosGenerales = [
            ['titulo' => 'Principal', 'detalles' => 'Expediente principal de la causa'],
            ['titulo' => 'Incidente', 'detalles' => 'Expediente incidental'],
            ['titulo' => 'Medida Cautelar', 'detalles' => 'Embargo, inhibición, etc.'],
            ['titulo' => 'Beneficio de Litigar sin Gastos', 'detalles' => 'Incidente de pobreza'],
        ];

        foreach ($tiposPorCategoria as $categoria => $tipos) {
            $caseType = \App\Models\CaseType::where('name', $categoria)->first();
            if (! $caseType) {
                continue;
            }

            foreach ($tipos as $tipo) {
                \App\Models\TipoExpediente::updateOrCreate(
                    ['titulo' => $tipo['titulo'], 'case_type_id' => $caseType->id],
                    $tipo
                );
            }

            // Agregar procedimientos generales a cada categoría para que estén disponibles
            foreach ($procedimientosGenerales as $general) {
                \App\Models\TipoExpediente::updateOrCreate(
                    ['titulo' => $general['titulo'], 'case_type_id' => $caseType->id],
                    $general
                );
            }
        }
    }
}
