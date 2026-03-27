<?php

namespace Database\Seeders;

use App\Models\Bitacora;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

class BitacoraSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = User::all();
        if ($users->isEmpty()) {
            return;
        }

        $actions = ['created', 'updated', 'deleted', 'viewed', 'downloaded', 'archived', 'restored'];
        $entityTypes = array_keys(Bitacora::ENTITY_MAPPING);

        for ($i = 0; $i < 20; $i++) {
            $user = $users->random();
            $type = Arr::random($entityTypes);
            $action = Arr::random($actions);
            $modelClass = Bitacora::ENTITY_MAPPING[$type];

            // Intentar obtener una id válida de la entidad seleccionada
            $entityId = $modelClass::inRandomOrder()->value('id') ?? rand(1, 100);

            Bitacora::create([
                'user_id' => $user->id,
                'action' => $action,
                'entity_id' => $entityId,
                'entity_type' => $type,
                'created_at' => now()->subMinutes(rand(1, 10000)),
            ]);
        }

        $this->command->info('Seed de bitácora completado con 20 movimientos aleatorios.');
    }
}
