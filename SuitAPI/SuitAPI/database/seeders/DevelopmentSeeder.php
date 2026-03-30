<?php

namespace Database\Seeders;

use App\Models\Agenda;
use App\Models\CaseType;
use App\Models\Client;
use App\Models\Deadline;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Entrega;
use App\Models\Event;
use App\Models\EventType;
use App\Models\File;
use App\Models\Gasto;
use App\Models\GastoSuitCase;
use App\Models\Honorario;
use App\Models\Multimedia;
use App\Models\Parte;
use App\Models\PublicFile;
use App\Models\PublicFileCatalog;
use App\Models\Radicacion;
use App\Models\Rol;
use App\Models\SuitCase;
use App\Models\TipoPago;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DevelopmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        $this->command->info('Iniciando seed de desarrollo enriquecido...');

        // 1. Llamar al ProductionSeeder (Catálogos base y Admin)
        $this->call(ProductionSeeder::class);

        // 2. Otros catálogos necesarios para desarrollo (Evitamos los repetidos)
        $this->call([
            PublicFileCatalogSeeder::class,
            TemplateCategoriesTableSeeder::class,
            TemplatesTableSeeder::class,
        ]);
        // $this->call(JudicialSeeder::class); // Deshabilitamos si falla por duplicados

        // 3. Crear Usuarios test y user
        $testUser = User::updateOrCreate(
            ['tag' => 'test'],
            [
                'name' => 'Test Abogado',
                'password' => Hash::make('testtest'),
                'role' => 'lawyer',
                'email' => 'test@suitapi.com',
            ]
        );

        $testAgenda = Agenda::firstOrCreate(
            ['user_id' => $testUser->id, 'suit_case_id' => null],
            ['name' => 'Personal Agenda: '.$testUser->name]
        );
        $testAgenda->syncAccessibleUsers(); // Asegurar que el dueño esté en la tabla pivot

        $normalUser = User::updateOrCreate(
            ['tag' => 'user'],
            [
                'name' => 'User Abogado',
                'password' => Hash::make('useruser'),
                'role' => 'lawyer',
                'email' => 'user@suitapi.com',
            ]
        );

        $normalAgenda = Agenda::firstOrCreate(
            ['user_id' => $normalUser->id, 'suit_case_id' => null],
            ['name' => 'Personal Agenda: '.$normalUser->name]
        );
        $normalAgenda->syncAccessibleUsers(); // Asegurar que el dueño esté en la tabla pivot

        // 4. Crear muchísimos Clientes
        $this->command->info('Creando clientes adicionales...');
        $clients = Client::factory(20)->create();

        // 5. Crear muchos Casos de prueba
        $this->command->info('Creando casos de prueba...');
        $caseTypes = CaseType::all();
        if ($caseTypes->isEmpty()) {
            $caseTypes = collect([CaseType::factory()->create()]);
        }
        $roles = Rol::all();
        $tiposPago = TipoPago::all();
        $gastoTipos = Gasto::all();
        $eventTypes = EventType::all();
        $catalog = PublicFileCatalog::first();
        $radicaciones = Radicacion::all();
        $dependencias = \App\Models\DependenciaJudicial::all();

        // Crear una mezcla de casos para testUser y normalUser
        for ($i = 1; $i <= 30; $i++) {
            $owner = ($i % 2 === 0) ? $testUser : $normalUser;
            $participant = ($i % 2 === 0) ? $normalUser : $testUser;

            // Determinar una fecha de inicio realista entre Nov 2025 y Marzo 2026
            $startDate = Carbon::create(2025, 11, 1)->addDays(rand(0, 140));

            $case = SuitCase::create([
                'title' => "Caso de Desarrollo #{$i}: ".($i % 2 === 0 ? 'Test' : 'User').' Owner',
                'lawyer_id' => $owner->id,
                'case_type_id' => $caseTypes->random()->id,
                'radicacion_id' => $radicaciones->random()->id,
                'dependencia_id' => $dependencias->random()->id,
                'nro_expediente' => 'EXP-'.str_pad($i, 3, '0', STR_PAD_LEFT).'/'.$startDate->year,
                'start_date' => $startDate,
                'status' => rand(1, 10) > 8 ? 'closed' : 'active',
                'details' => "Detalles del caso #{$i} creado automáticamente para desarrollo con fecha {$startDate->toDateString()}.",
            ]);

            // Forzar created_at para que coincida con start_date para reportes
            $case->created_at = $startDate;
            $case->updated_at = $startDate;
            $case->save();

            $caseAgenda = Agenda::create([
                'name' => 'Agenda: '.$case->title,
                'user_id' => $owner->id,
                'suit_case_id' => $case->id,
            ]);

            $case->participants()->attach($participant->id, [
                'permission_level' => ($i % 4 === 0) ? 'view' : 'edit',
            ]);

            // Asignar 1-4 clientes al caso
            $caseClients = $clients->random(rand(1, 4));
            $case->clients()->attach($caseClients->pluck('id'));

            // Sincronizar usuarios de la agenda después de añadir participantes
            $caseAgenda->syncAccessibleUsers();

            // 6. Meter Honorarios y Entregas con fechas realistas
            foreach ($caseClients as $caseClient) {
                for ($h = 0; $h < rand(1, 2); $h++) {
                    $honDate = $startDate->copy()->addDays(rand(1, 15));
                    $honorario = Honorario::create([
                        'suit_case_id' => $case->id,
                        'client_id' => $caseClient->id,
                        'user_id' => $owner->id,
                        'monto' => rand(5000, 75000),
                        'detalles' => "Honorario #{$h} pactado por el caso ".$case->nro_expediente,
                        'pagado' => false,
                    ]);
                    $honorario->created_at = $honDate;
                    $honorario->updated_at = $honDate;
                    $honorario->save();

                    // Varias entregas para el honorario, esparcidas en el tiempo
                    $numEntregas = rand(0, 3);
                    $currentDate = $honDate->copy();
                    for ($e = 0; $e < $numEntregas; $e++) {
                        $currentDate->addDays(rand(5, 20));
                        // No crear entregas en el futuro (despues de hoy)
                        if ($currentDate->gt(now())) {
                            break;
                        }

                        $entrega = Entrega::create([
                            'honorario_id' => $honorario->id,
                            'tipo_pago_id' => $tiposPago->random()->id,
                            'monto' => $honorario->monto * (rand(1, 3) / 10),
                            'nota' => "Entrega #{$e} a cuenta",
                        ]);
                        $entrega->created_at = $currentDate->copy();
                        $entrega->updated_at = $currentDate->copy();
                        $entrega->save();
                    }
                    $honorario->recalcularPagado();
                }
            }

            // 7. Meter Gastos esparcidos
            for ($j = 0; $j < rand(2, 6); $j++) {
                $gastoDate = $startDate->copy()->addDays(rand(1, 60));
                if ($gastoDate->gt(now())) {
                    $gastoDate = now();
                }

                $gasto = GastoSuitCase::create([
                    'gasto_id' => $gastoTipos->random()->id,
                    'suit_case_id' => $case->id,
                    'user_id' => $owner->id,
                    'monto' => rand(50, 3500),
                ]);
                $gasto->created_at = $gastoDate;
                $gasto->updated_at = $gastoDate;
                $gasto->save();
            }

            // 8. Meter Partes
            for ($j = 0; $j < rand(3, 7); $j++) {
                $parte = Parte::factory()->create([
                    'rol_id' => $roles->random()->id,
                ]);
                $case->partes()->attach($parte->id);
            }

            // 9. Eventos y Vencimientos esparcidos a lo largo del año
            $this->command->info("Añadiendo eventos al caso #{$i}...");
            $numEvents = rand(5, 12);
            for ($j = 0; $j < $numEvents; $j++) {
                $eventType = $eventTypes->random();
                // Esparcir eventos desde el inicio del caso hasta finales de 2026
                // startDate es entre Nov 2025 y Marzo 2026.
                // Queremos eventos que cubran todo el año.
                $daysToAdd = rand(-15, 300);
                $startsAt = $startDate->copy()->addDays($daysToAdd);

                // Evitar eventos demasiado en el pasado o futuro lejano si no queremos
                if ($startsAt->year > 2026) {
                    $startsAt->setYear(2026);
                }

                $event = Event::create([
                    'agenda_id' => $caseAgenda->id,
                    'suit_case_id' => $case->id,
                    'title' => "{$eventType->name} (#{$j}): ".$case->nro_expediente,
                    'description' => 'Evento de seguimiento para el caso '.$case->title,
                    'event_type_id' => $eventType->id,
                    'starts_at' => $startsAt,
                    'is_all_day' => (rand(1, 10) > 8),
                ]);

                // Vencimientos para un 40% de los eventos
                if (rand(1, 10) > 6) {
                    Deadline::create([
                        'event_id' => $event->id,
                        'title' => 'CUMPLIR: '.$event->title,
                        'description' => 'Vencimiento mandatorio generado para seguimiento.',
                        'due_date' => $startsAt->copy()->addHours(rand(1, 48)),
                        'priority' => rand(1, 10) > 7 ? Deadline::PRIORITY_URGENT : Deadline::PRIORITY_NORMAL,
                        'status' => $startsAt->lt(now()) ? Deadline::STATUS_COMPLETED : Deadline::STATUS_PENDING,
                    ]);
                }
            }

            // 10. Archivos, Multimedia y Documentos fake para este caso
            $this->command->info("Añadiendo archivos fake al caso #{$i}...");

            // Documentos con versiones
            for ($d = 1; $d <= 2; $d++) {
                $doc = Document::create([
                    'name' => "Documento de Prueba {$d}.pdf",
                    'category' => 'document',
                    'user_id' => $owner->id,
                    'suit_case_id' => $case->id,
                    'is_locked' => false,
                ]);

                DocumentVersion::create([
                    'document_id' => $doc->id,
                    'version_number' => 1,
                    'file_path' => 'documents/'.Str::uuid().'.pdf',
                    'mime_type' => 'application/pdf',
                    'size' => rand(1024, 1024 * 1024),
                    'encryption_iv' => base64_encode(random_bytes(16)),
                    'checksum' => hash('sha256', "fake-content-{$i}-{$d}"),
                    'created_by' => $owner->id,
                ]);
            }

            // Multimedia
            for ($m = 1; $m <= 2; $m++) {
                Multimedia::create([
                    'filename' => "Evidencia_Visual_{$m}.png",
                    'path' => 'secure_media/'.Str::uuid().'.png',
                    'hash' => hash('sha256', "fake-media-{$i}-{$m}"),
                    'mime_type' => 'image/png',
                    'size' => rand(1024, 1024 * 512),
                    'encryption_iv' => base64_encode(random_bytes(16)),
                    'suit_case_id' => $case->id,
                    'user_id' => $owner->id,
                ]);
            }

            // Archivos generales
            for ($f = 1; $f <= 2; $f++) {
                File::create([
                    'filename' => "Anexo_General_{$f}.pdf",
                    'path' => 'secure_files/'.Str::uuid().'.pdf',
                    'hash' => hash('sha256', "fake-file-{$i}-{$f}"),
                    'mime_type' => 'application/pdf',
                    'size' => rand(1024, 1024 * 2048),
                    'encryption_iv' => base64_encode(random_bytes(16)),
                    'suit_case_id' => $case->id,
                    'user_id' => $owner->id,
                ]);
            }
        }

        // 11. Eventos Personales para Test User y Normal User a lo largo de 2026
        $this->command->info('Creando eventos personales para Test User y Normal User (promedio 1 cada 2 días)...');
        $currentDate = Carbon::create(2026, 1, 1);
        $endDate = Carbon::create(2026, 12, 31);
        $personalAgendaTest = $testAgenda;
        $personalAgendaNormal = $normalAgenda;

        while ($currentDate->lte($endDate)) {
            // Un evento cada ~2 días para cada uno
            if (rand(1, 10) > 5) {
                $eventType = $eventTypes->random();
                $startsAt = $currentDate->copy()->setHour(rand(8, 20))->setMinute(0);

                Event::create([
                    'agenda_id' => $personalAgendaTest->id,
                    'suit_case_id' => null,
                    'title' => "Personal: {$eventType->name}",
                    'description' => "Tarea personal de la agenda de {$testUser->name}",
                    'event_type_id' => $eventType->id,
                    'starts_at' => $startsAt,
                    'is_all_day' => false,
                ]);
            }

            if (rand(1, 10) > 5) {
                $eventType = $eventTypes->random();
                $startsAt = $currentDate->copy()->setHour(rand(8, 20))->setMinute(0);

                Event::create([
                    'agenda_id' => $personalAgendaNormal->id,
                    'suit_case_id' => null,
                    'title' => "Personal: {$eventType->name}",
                    'description' => "Tarea personal de la agenda de {$normalUser->name}",
                    'event_type_id' => $eventType->id,
                    'starts_at' => $startsAt,
                    'is_all_day' => false,
                ]);
            }

            $currentDate->addDay();
        }

        // Eventos extra para "User Abogado" en el periodo actual (Marzo 2026)
        $this->command->info('Añadiendo eventos extra para el mes actual para User Abogado...');
        for ($i = 0; $i < 15; $i++) {
            $eventType = $eventTypes->random();
            $startsAt = Carbon::now()->startOfMonth()->addDays(rand(0, 30))->setHour(rand(8, 18));
            Event::create([
                'agenda_id' => $personalAgendaNormal->id,
                'suit_case_id' => null,
                'title' => "URGENTE: {$eventType->name}",
                'description' => 'Evento extra para pruebas de agenda del usuario normal.',
                'event_type_id' => $eventType->id,
                'starts_at' => $startsAt,
                'is_all_day' => rand(0, 1),
            ]);
        }

        // 12. PublicFiles con archivos dummy físicos
        $this->command->info('Creando archivos públicos dummy...');
        $fileTypes = [
            ['name' => 'Demo_TestPDF.pdf', 'ext' => 'pdf', 'mime' => 'application/pdf', 'content' => '%PDF-1.4\n1 0 obj\n<< /Title (Test PDF) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'],
            ['name' => 'Demo_TestDOCX.docx', 'ext' => 'docx', 'mime' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content' => 'PK...Dummy DOCX Content'],
            ['name' => 'Demo_TestXLSX.xlsx', 'ext' => 'xlsx', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content' => 'PK...Dummy XLSX Content'],
            ['name' => 'Demo_Captura.png', 'ext' => 'png', 'mime' => 'image/png', 'content' => 'PNG...Dummy Image Content'],
            ['name' => 'Nota_Test.txt', 'ext' => 'txt', 'mime' => 'text/plain', 'content' => 'Este es un archivo de texto de prueba.'],
        ];

        foreach ($fileTypes as $fType) {
            $uuid = Str::uuid();
            $path = $uuid.'.'.$fType['ext'];

            // Guardar físicamente en el disco configurado
            Storage::disk('public_files')->put($path, $fType['content']);

            PublicFile::updateOrCreate(
                ['name' => $fType['name'], 'public_file_catalog_id' => $catalog->id],
                [
                    'uuid' => $uuid,
                    'user_id' => $testUser->id,
                    'path' => $path,
                    'mime_type' => $fType['mime'],
                    'size' => strlen($fType['content']),
                    'hash' => hash('sha256', $fType['content']),
                ]
            );
        }

        // 13. Registros borrados antiguos (>30 días) para pruebas de purga/sincronización
        $this->command->info('Creando registros borrados antiguos (>30 días)...');
        $oldDate = Carbon::now()->subDays(rand(31, 45));
        $someCase = SuitCase::orderBy('id', 'desc')->first();

        // Casos borrados
        for ($i = 1; $i <= 5; $i++) {
            $oldCase = SuitCase::create([
                'title' => "Caso Borrado Antiguo #{$i}",
                'lawyer_id' => $testUser->id,
                'case_type_id' => $caseTypes->random()->id,
                'radicacion_id' => $radicaciones->random()->id,
                'dependencia_id' => $dependencias->random()->id,
                'nro_expediente' => 'DEL-'.str_pad($i, 3, '0', STR_PAD_LEFT).'/2025',
                'start_date' => $oldDate->copy()->subMonths(2),
                'status' => 'closed',
                'details' => 'Este caso fue borrado hace más de 30 días.',
            ]);
            $oldCase->created_at = $oldDate->copy()->subMonths(2);
            $oldCase->deleted_at = $oldDate;
            $oldCase->save();
        }

        // Documentos borrados
        for ($i = 1; $i <= 5; $i++) {
            $oldDoc = Document::create([
                'name' => "Documento Borrado #{$i}.pdf",
                'category' => 'document',
                'user_id' => $testUser->id,
                'suit_case_id' => $someCase->id,
                'is_locked' => false,
            ]);
            $oldDoc->created_at = $oldDate->copy()->subMonths(1);
            $oldDoc->deleted_at = $oldDate;
            $oldDoc->save();
        }

        // Gastos borrados
        for ($i = 1; $i <= 5; $i++) {
            $oldGasto = GastoSuitCase::create([
                'gasto_id' => $gastoTipos->random()->id,
                'suit_case_id' => $someCase->id,
                'user_id' => $testUser->id,
                'monto' => rand(100, 500),
            ]);
            $oldGasto->created_at = $oldDate->copy()->subDays(10);
            $oldGasto->deleted_at = $oldDate;
            $oldGasto->save();
        }

        $this->call(BitacoraSeeder::class);

        Schema::enableForeignKeyConstraints();

        $this->command->info('DevelopmentSeeder totalmente enriquecido ejecutado con éxito.');
    }
}
