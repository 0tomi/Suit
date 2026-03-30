<?php

namespace Database\Seeders;

use App\Models\Requisito;
use Illuminate\Database\Seeder;

class RequisitoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $requisitos = [
            // Generales
            ['type' => 'text', 'title' => 'Texto'],
            ['type' => 'number', 'title' => 'Número'],
            ['type' => 'date', 'title' => 'Fecha'],
            ['type' => 'dateTime', 'title' => 'Fecha y Hora'],

            // Cliente
            ['type' => 'clientCompleteName', 'title' => 'Nombre Completo del Cliente'],
            ['type' => 'clientFirstName', 'title' => 'Nombre del Cliente'],
            ['type' => 'clientLastName', 'title' => 'Apellido del Cliente'],
            ['type' => 'clientIdentification', 'title' => 'DNI/CUIT del Cliente'],
            ['type' => 'clientAddress', 'title' => 'Dirección del Cliente'],
            ['type' => 'clientEmail', 'title' => 'Email del Cliente'],
            ['type' => 'clientPhone', 'title' => 'Teléfono del Cliente'],

            // Usuario/Abogado
            ['type' => 'userCompleteName', 'title' => 'Nombre Completo del Abogado'],
            ['type' => 'userName', 'title' => 'Nombre del Abogado'],
            ['type' => 'userLastName', 'title' => 'Apellido del Abogado'],
            ['type' => 'userEmail', 'title' => 'Email del Abogado'],
            ['type' => 'userRegistration', 'title' => 'Matrícula del Abogado'],
            ['type' => 'userCuit', 'title' => 'CUIT del Abogado'],

            // Caso / Expediente
            ['type' => 'caseTitle', 'title' => 'Carátula/Título del Caso'],
            ['type' => 'caseNumber', 'title' => 'Número de Expediente'],
            ['type' => 'caseType', 'title' => 'Tipo de Proceso'],
            ['type' => 'caseExpedientType', 'title' => 'Tipo de Expediente'],
            ['type' => 'caseStartDate', 'title' => 'Fecha de Inicio'],
            ['type' => 'caseEndDate', 'title' => 'Fecha de Finalización'],

            // Infraestructura Judicial
            ['type' => 'radicacion', 'title' => 'Radicación (Fuero)'],
            ['type' => 'jurisdiccion', 'title' => 'Jurisdicción'],
            ['type' => 'competencia', 'title' => 'Fuero/Competencia'],
            ['type' => 'dependencia', 'title' => 'Dependencia Judicial'],

            // Partes Contrarias
            ['type' => 'parteCompleteName', 'title' => 'Nombre de la Contraparte'],
            ['type' => 'parteIdentification', 'title' => 'DNI/CUIT de la Contraparte'],
            ['type' => 'parteAddress', 'title' => 'Dirección de la Contraparte'],

            // Financiera
            ['type' => 'amount', 'title' => 'Monto'],
            ['type' => 'paymentType', 'title' => 'Tipo de Pago'],
            ['type' => 'montoNombrado', 'title' => 'Monto Nombrado'],

            // Ubicación / Geografía
            ['type' => 'city', 'title' => 'Ciudad'],
            ['type' => 'province', 'title' => 'Provincia'],
            ['type' => 'address', 'title' => 'Dirección General'],

            // Fechas
            ['type' => 'anioNombrado', 'title' => 'Año Nombrado'],
            ['type' => 'mesNombrado', 'title' => 'Mes Nombrado'],
            ['type' => 'diaNombrado', 'title' => 'Día Nombrado'],
            ['type' => 'anioNumero', 'title' => 'Año (Número)'],
            ['type' => 'mesNumero', 'title' => 'Mes (Número)'],
            ['type' => 'diaNumero', 'title' => 'Día (Número)'],
            ['type' => 'fechaConMesNombrado', 'title' => 'Fecha con Mes Nombrado'],

            // Eventos
            ['type' => 'eventType', 'title' => 'Tipo de Evento'],
            ['type' => 'eventName', 'title' => 'Nombre/Título del Evento'],
            ['type' => 'eventDate', 'title' => 'Fecha del Evento'],

            // Especial
            ['type' => 'custom', 'title' => 'Campo Personalizado'],
        ];

        foreach ($requisitos as $req) {
            Requisito::updateOrCreate(
                ['type' => $req['type']],
                [
                    'title' => $req['title'],
                ]
            );
        }
    }
}
