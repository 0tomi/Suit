<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class GastoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $gastos = [
            ['titulo' => 'Sellados', 'detalles' => 'Gastos en concepto de sellados y tasas de justicia'],
            ['titulo' => 'Nafta', 'detalles' => 'Gastos de combustible para traslados'],
            ['titulo' => 'Movilidad', 'detalles' => 'Gastos de transporte público, taxis o remises'],
            ['titulo' => 'Fotocopias', 'detalles' => 'Gastos de librería, fotocopias e impresiones'],
            ['titulo' => 'Notificaciones', 'detalles' => 'Gastos en cartas documento, cédulas y mandamientos'],
            ['titulo' => 'Peritos', 'detalles' => 'Honorarios o anticipos para peritos'],
        ];

        foreach ($gastos as $gasto) {
            \App\Models\Gasto::firstOrCreate(['titulo' => $gasto['titulo']], $gasto);
        }
    }
}
