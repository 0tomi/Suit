<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PlantillaRequisito>
 */
class PlantillaRequisitoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'template_id' => \App\Models\Template::factory(),
            'requisito_id' => \App\Models\Requisito::factory(),
            'id_campo' => $this->faker->unique()->word(),
        ];
    }
}
