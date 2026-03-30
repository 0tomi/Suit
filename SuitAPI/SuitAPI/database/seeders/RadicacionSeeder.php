<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class RadicacionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tipos = [
            'Provincial',
            'Federal',
            'Administrativo',
        ];

        foreach ($tipos as $tipo) {
            \App\Models\Radicacion::withTrashed()->firstOrCreate(['tipo' => $tipo]);
        }
    }
}
