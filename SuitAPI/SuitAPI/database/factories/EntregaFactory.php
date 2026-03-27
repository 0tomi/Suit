<?php

namespace Database\Factories;

use App\Models\Honorario;
use App\Models\TipoPago;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Entrega>
 */
class EntregaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'honorario_id' => Honorario::factory(),
            'tipo_pago_id' => TipoPago::factory(),
            'monto' => $this->faker->randomFloat(2, 100, 5000),
            'nota' => $this->faker->sentence(),
            'created_at' => $this->faker->dateTimeBetween('-5 months', 'now'),
        ];
    }
}
