<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class PublicFileCatalogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\PublicFileCatalog::firstOrCreate([
            'name' => 'General',
        ], [
            'description' => 'Catálogo general por defecto',
        ]);
    }
}
