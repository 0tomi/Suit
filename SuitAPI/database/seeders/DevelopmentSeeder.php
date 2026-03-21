<?php

namespace Database\Seeders;

use App\Models\Agenda;
use App\Models\CaseType;
use App\Models\Client;
use App\Models\Radicacion;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class DevelopmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        // 1. Llamar al ProductionSeeder (Catálogos base y Admin)
        $this->call(ProductionSeeder::class);

        // 2. Otros catálogos necesarios para desarrollo
        $this->call(RolSeeder::class);

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

        Agenda::firstOrCreate(
            ['user_id' => $testUser->id, 'suit_case_id' => null],
            ['name' => 'Personal Agenda: ' . $testUser->name]
        );

        $normalUser = User::updateOrCreate(
            ['tag' => 'user'],
            [
                'name' => 'User Abogado',
                'password' => Hash::make('useruser'),
                'role' => 'lawyer',
                'email' => 'user@suitapi.com',
            ]
        );

        Agenda::firstOrCreate(
            ['user_id' => $normalUser->id, 'suit_case_id' => null],
            ['name' => 'Personal Agenda: ' . $normalUser->name]
        );

        // 4. Crear Clientes para los casos
        $client = Client::factory()->create([
            'first_name' => 'Juan',
            'last_name' => 'Perez',
        ]);

        // 5. Crear Casos de prueba
        $caseType = CaseType::first() ?? CaseType::factory()->create();
        $radicacion = Radicacion::first() ?? Radicacion::factory()->create();

        // Caso 1: Dueño test, Participante user
        $case1 = SuitCase::create([
            'title' => 'Caso de Prueba: Test Owner',
            'lawyer_id' => $testUser->id,
            'case_type_id' => $caseType->id,
            'radicacion_id' => $radicacion->id,
            'nro_expediente' => 'EXP-001/2026',
            'start_date' => now(),
            'status' => 'active',
            'details' => 'Caso creado para pruebas de desarrollo donde test es el dueño.',
        ]);

        Agenda::create([
            'name' => 'Agenda: ' . $case1->title,
            'user_id' => $testUser->id,
            'suit_case_id' => $case1->id,
        ]);

        $case1->participants()->attach($normalUser->id, ['permission_level' => 'edit']);
        $case1->clients()->attach($client->id);

        // Caso 2: Dueño user, Participante test
        $case2 = SuitCase::create([
            'title' => 'Caso de Prueba: User Owner',
            'lawyer_id' => $normalUser->id,
            'case_type_id' => $caseType->id,
            'radicacion_id' => $radicacion->id,
            'nro_expediente' => 'EXP-002/2026',
            'start_date' => now(),
            'status' => 'active',
            'details' => 'Caso creado para pruebas de desarrollo donde user es el dueño.',
        ]);

        Agenda::create([
            'name' => 'Agenda: ' . $case2->title,
            'user_id' => $normalUser->id,
            'suit_case_id' => $case2->id,
        ]);

        $case2->participants()->attach($testUser->id, ['permission_level' => 'view']);
        $case2->clients()->attach($client->id);

        Schema::enableForeignKeyConstraints();

        $this->command->info('DevelopmentSeeder ejecutado con éxito. Usuarios test (testtest) y user (useruser) listos.');
    }
}
