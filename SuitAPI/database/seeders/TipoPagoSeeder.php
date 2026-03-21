<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class TipoPagoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tipos = [
            ['titulo' => 'Efectivo', 'detalles' => 'Pago realizado en dinero en efectivo'],
            ['titulo' => 'Transferencia', 'detalles' => 'Transferencia bancaria o billetera virtual'],
            ['titulo' => 'Cheque', 'detalles' => 'Pago realizado mediante cheque'],
            ['titulo' => 'Tarjeta de Crédito', 'detalles' => 'Pago realizado con tarjeta de crédito'],
            ['titulo' => 'Tarjeta de Débito', 'detalles' => 'Pago realizado con tarjeta de débito'],
        ];

        foreach ($tipos as $tipo) {
            \App\Models\TipoPago::firstOrCreate(['titulo' => $tipo['titulo']], $tipo);
        }
    }
}
