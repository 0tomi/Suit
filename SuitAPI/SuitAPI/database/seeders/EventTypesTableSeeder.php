<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class EventTypesTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        $eventTypes = [
            ['id' => 1, 'name' => 'Otro', 'color' => null],
            ['id' => 2, 'name' => 'Vencimiento', 'color' => '#facc15'],
            ['id' => 3, 'name' => 'Audiencia', 'color' => '#ef4444'],
            ['id' => 4, 'name' => 'Reunión', 'color' => '#3b82f6'],
            ['id' => 5, 'name' => 'Escrito', 'color' => '#6366f1'],
            ['id' => 6, 'name' => 'Pericia', 'color' => '#a855f7'],
            ['id' => 7, 'name' => 'Traslado', 'color' => '#f97316'],
            ['id' => 8, 'name' => 'Sentencia', 'color' => '#22c55e'],
            ['id' => 9, 'name' => 'Cédula', 'color' => '#06b6d4'],
            ['id' => 10, 'name' => 'Oficio', 'color' => '#64748b'],
        ];

        foreach ($eventTypes as $item) {
            \DB::table('event_types')->updateOrInsert(
                ['id' => $item['id']],
                array_merge($item, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('event_types', 'id'), COALESCE((SELECT MAX(id) FROM event_types), 1))");
        }

    }
}
