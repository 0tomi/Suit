<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class JudicialBaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\Radicacion::firstOrCreate(['tipo' => 'Federal']);
        \App\Models\Jurisdiccion::firstOrCreate(['nombre' => 'Federal']);
    }
}
