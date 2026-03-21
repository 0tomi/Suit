<?php

namespace Database\Seeders;

use App\Models\Agenda;
use App\Models\EventType;
use App\Models\TemplateCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ProductionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Tipos de Eventos
        $eventTypes = [
            ['name' => 'Otro', 'color' => null],
            ['name' => 'Vencimiento', 'color' => '#facc15'], // Amarillo
            ['name' => 'Audiencia', 'color' => '#ef4444'],   // Rojo
            ['name' => 'Reunión', 'color' => '#3b82f6'],     // Azul
            ['name' => 'Escrito', 'color' => '#6366f1'],     // Indigo
            ['name' => 'Pericia', 'color' => '#a855f7'],     // Púrpura
            ['name' => 'Traslado', 'color' => '#f97316'],    // Naranja
            ['name' => 'Sentencia', 'color' => '#22c55e'],    // Verde
            ['name' => 'Cédula', 'color' => '#06b6d4'],      // Cian
            ['name' => 'Oficio', 'color' => '#64748b'],      // Slate/Gris
        ];

        foreach ($eventTypes as $type) {
            EventType::updateOrCreate(
                ['name' => $type['name']],
                ['color' => $type['color']]
            );
        }

        // 2. Categoría de Plantilla "General"
        // La migración original no lo está creando, así que lo inyectamos aquí.
        TemplateCategory::firstOrCreate(
            ['name' => 'General'],
            ['description' => 'Categoría general por defecto']
        );

        // 3. Catálogos Profesionales
        $this->call([
            RolSeeder::class,
            CaseTypesTableSeeder::class,
            RadicacionSeeder::class,
            TipoPagoSeeder::class,
            GastoSeeder::class,
            TipoExpedienteSeeder::class,
            SettingsSeeder::class,
        ]);

        // 4. Usuario Administrador principal
        $admin = User::firstOrCreate(
            ['tag' => 'admin'],
            [
                'name' => 'Administrador Base',
                // El email ahora es opcional/nulo a nivel de base de datos
                'email' => null,
                'password' => Hash::make('adminadmin'),
                'role' => 'admin',
            ]
        );

        // Como el sistema requiere que todos los usuarios tengan su agenda
        // personal (según vimos en el AuthController), se la creamos:
        Agenda::firstOrCreate(
            ['user_id' => $admin->id, 'suit_case_id' => null],
            [
                'name' => 'Personal Agenda: '.$admin->name,
            ]
        );

        $this->command->info('Seeder de Producción ejecutado correctamente. Admin inicializado.');
    }
}
