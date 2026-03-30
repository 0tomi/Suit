<?php

namespace Database\Factories;

use App\Models\TipoPago;
use Illuminate\Database\Eloquent\Factories\Factory;

class TipoPagoFactory extends Factory
{
    protected $model = TipoPago::class;

    public function definition(): array
    {
        return [
            'titulo' => $this->faker->word(),
            'detalles' => $this->faker->sentence(),
        ];
    }
}
