<?php

namespace Database\Seeders;

use App\Models\Rol;
use Illuminate\Database\Seeder;

class RolSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'Actor',
            'Demandado',
            'Co-actor',
            'Co-demandado',
            'Tercero',
            'Citado en Garantía',
            'Abogado',
            'Juez',
            'Secretario',
            'Fiscal',
            'Perito',
            'Consultor Técnico',
            'Mediador',
            'Martillero',
            'Testigo',
            'Querellante',
            'Particular Damnificado',
            'Defensor',
            'Síndico',
            'Curador',
        ];

        foreach ($roles as $titulo) {
            Rol::firstOrCreate(['titulo' => $titulo]);
        }
    }
}
