<?php

namespace Database\Seeders;

use App\Models\Requisito;
use App\Models\Template;
use App\Models\TemplateCategory;
use Illuminate\Database\Seeder;

class TemplatesTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {
        // Limpiar tablas para evitar duplicados al re-sembrar con nuevos títulos o formatos
        \DB::table('plantilla_requisitos')->delete();
        \DB::table('templates')->delete();

        $categoryEscritos = TemplateCategory::where('name', 'Escritos Judiciales')->first();
        $categoryContratos = TemplateCategory::where('name', 'Contratos')->first();
        $categoryCartas = TemplateCategory::where('name', 'Cartas Documento')->first();

        $templates = [
            [
                'title' => 'Demanda por Daños y Perjuicios (Multi-Actor)',
                'template_category_id' => $categoryEscritos->id,
                'content' => '<h3>PROMUEVE DEMANDA POR DAÑOS Y PERJUICIOS</h3><p>Señor Juez:</p><p><strong>#1#</strong>, con domicilio en #2# y <strong>#3#</strong>, con domicilio en #4#, por sus propios derechos, asistidos por su letrado patrocinante #5#, en los autos caratulados <em>#6#</em> (Expte. #7#), a V.S. decimos:</p><p>Que venimos por la presente a reclamar la suma de #8#...</p><p>En la ciudad de #9#, a los #10#.</p>',
                'requirements' => [
                    ['type' => 'clientCompleteName', 'id_campo' => 1, 'NEntidad' => 1],
                    ['type' => 'clientAddress', 'id_campo' => 2, 'NEntidad' => 1],
                    ['type' => 'clientCompleteName', 'id_campo' => 3, 'NEntidad' => 2],
                    ['type' => 'clientAddress', 'id_campo' => 4, 'NEntidad' => 2],
                    ['type' => 'userCompleteName', 'id_campo' => 5, 'NEntidad' => 1],
                    ['type' => 'caseTitle', 'id_campo' => 6, 'NEntidad' => 1],
                    ['type' => 'caseNumber', 'id_campo' => 7, 'NEntidad' => 1],
                    ['type' => 'amount', 'id_campo' => 8, 'NEntidad' => 1, 'note' => 'Monto total'],
                    ['type' => 'city', 'id_campo' => 9, 'NEntidad' => 1],
                    ['type' => 'date', 'id_campo' => 10, 'NEntidad' => 1],
                ],
            ],
            [
                'title' => 'Contrato de Locación Inmobiliaria (Varios Locatarios)',
                'template_category_id' => $categoryContratos->id,
                'content' => '<h2>CONTRATO DE LOCACIÓN</h2><p>Entre #1# (DNI #2#), con domicilio en #3# en adelante el <strong>LOCADOR</strong>, y por la otra parte #4# (DNI #5#) y #6# (DNI #7#) en adelante los <strong>LOCATARIOS</strong>, convienen lo siguiente:</p><p><strong>PRIMERA:</strong> El locatario abonará la suma de #8# mensuales...</p><p>Firmado en #9#, a los #10#.</p>',
                'requirements' => [
                    ['type' => 'clientCompleteName', 'id_campo' => 1, 'NEntidad' => 1],
                    ['type' => 'clientIdentification', 'id_campo' => 2, 'NEntidad' => 1],
                    ['type' => 'clientAddress', 'id_campo' => 3, 'NEntidad' => 1],
                    ['type' => 'parteCompleteName', 'id_campo' => 4, 'NEntidad' => 1],
                    ['type' => 'parteIdentification', 'id_campo' => 5, 'NEntidad' => 1],
                    ['type' => 'parteCompleteName', 'id_campo' => 6, 'NEntidad' => 2],
                    ['type' => 'parteIdentification', 'id_campo' => 7, 'NEntidad' => 2],
                    ['type' => 'amount', 'id_campo' => 8, 'NEntidad' => 1, 'note' => 'Alquiler'],
                    ['type' => 'city', 'id_campo' => 9, 'NEntidad' => 1],
                    ['type' => 'date', 'id_campo' => 10, 'NEntidad' => 1],
                ],
            ],
            [
                'title' => 'Carta Documento - Intimación de Pago',
                'template_category_id' => $categoryCartas->id,
                'content' => '<p>De mi mayor consideración:</p><p>En mi carácter de apoderado de #1#, intimo a Ud. (#2#) con domicilio en #3#, a que en el plazo de 48hs abone la suma de <strong>#4#</strong>...</p><p>Fecha: #5#.</p>',
                'requirements' => [
                    ['type' => 'clientCompleteName', 'id_campo' => 1, 'NEntidad' => 1],
                    ['type' => 'parteCompleteName', 'id_campo' => 2, 'NEntidad' => 1],
                    ['type' => 'parteAddress', 'id_campo' => 3, 'NEntidad' => 1],
                    ['type' => 'amount', 'id_campo' => 4, 'NEntidad' => 1],
                    ['type' => 'date', 'id_campo' => 5, 'NEntidad' => 1],
                ],
            ],
            [
                'title' => 'Cédula de Notificación Ley 22.172',
                'template_category_id' => $categoryEscritos->id,
                'content' => '<h3>CÉDULA DE NOTIFICACIÓN</h3><p>Hago saber a Ud. que en los autos <em>#1#</em> (Expte #2#) que tramitan ante el juzgado #3#, se ha dispuesto notificar a #4# en su domicilio de #5# la siguiente resolución...</p>',
                'requirements' => [
                    ['type' => 'caseTitle', 'id_campo' => 1, 'NEntidad' => 1],
                    ['type' => 'caseNumber', 'id_campo' => 2, 'NEntidad' => 1],
                    ['type' => 'dependencia', 'id_campo' => 3, 'NEntidad' => 1],
                    ['type' => 'parteCompleteName', 'id_campo' => 4, 'NEntidad' => 1],
                    ['type' => 'parteAddress', 'id_campo' => 5, 'NEntidad' => 1],
                ],
            ],
            [
                'title' => 'Escrito de Mero Trámite - Solicita Copias',
                'template_category_id' => $categoryEscritos->id,
                'content' => '<p>Señor Juez:</p><p><strong>#1#</strong>, en mi carácter de abogado en los autos #2# (Expte #3#), a V.S. digo:</p><p>Que vengo por la presente a solicitar copias de las actuaciones...</p><p>#4#, #5#.</p>',
                'requirements' => [
                    ['type' => 'userCompleteName', 'id_campo' => 1, 'NEntidad' => 1],
                    ['type' => 'caseTitle', 'id_campo' => 2, 'NEntidad' => 1],
                    ['type' => 'caseNumber', 'id_campo' => 3, 'NEntidad' => 1],
                    ['type' => 'city', 'id_campo' => 4, 'NEntidad' => 1],
                    ['type' => 'date', 'id_campo' => 5, 'NEntidad' => 1],
                ],
            ],
        ];

        foreach ($templates as $tData) {
            $requirements = $tData['requirements'];
            unset($tData['requirements']);

            $template = Template::create($tData);

            // Registrar cada requisito individualmente para evitar que sync()
            // sobrescriba tipos repetidos (ej: dos clientes distintos)
            foreach ($requirements as $reqData) {
                $requisito = Requisito::where('type', $reqData['type'])->first();
                if ($requisito) {
                    $template->requirements()->attach($requisito->id, [
                        'id_campo' => $reqData['id_campo'],
                        'NEntidad' => $reqData['NEntidad'] ?? 1,
                        'note' => $reqData['note'] ?? null,
                    ]);
                }
            }
        }
    }
}
