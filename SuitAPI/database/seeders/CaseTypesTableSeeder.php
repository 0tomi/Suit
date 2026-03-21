<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class CaseTypesTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {
        // Renombrar si existe el nombre antiguo para mantener coherencia en IDs
        $oldAdmin = \App\Models\CaseType::where('name', 'Contencioso Administrativo')->first();
        if ($oldAdmin) {
            $oldAdmin->update(['name' => 'Administrativo']);
        }

        $caseTypes = [
            ['name' => 'Penal', 'description' => 'Derecho Penal', 'eventColor' => '#EF4444'],
            ['name' => 'Civil', 'description' => 'Derecho Civil', 'eventColor' => '#3B82F6'],
            ['name' => 'Familia', 'description' => 'Derecho de Familia', 'eventColor' => '#EC4899'],
            ['name' => 'Laboral', 'description' => 'Derecho Laboral', 'eventColor' => '#F59E0B'],
            ['name' => 'Comercial', 'description' => 'Derecho Comercial', 'eventColor' => '#10B981'],
            ['name' => 'Administrativo', 'description' => 'Derecho Administrativo', 'eventColor' => '#8B5CF6'],
        ];

        foreach ($caseTypes as $type) {
            \App\Models\CaseType::updateOrCreate(
                ['name' => $type['name']],
                array_merge($type, [
                    'updated_at' => now(),
                ])
            );
        }

        // Eliminar los que ya no están en la lista para una "versión más limpia"
        $names = array_column($caseTypes, 'name');
        \App\Models\CaseType::whereNotIn('name', $names)->delete();

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('case_types', 'id'), COALESCE((SELECT MAX(id) FROM case_types), 1))");
        }
    }
}
