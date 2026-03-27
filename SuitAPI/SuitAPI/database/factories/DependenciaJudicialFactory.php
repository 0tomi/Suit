<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\DependenciaJudicial>
 */
class DependenciaJudicialFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'jurisdiccion_id' => \App\Models\Jurisdiccion::factory(),
            'competencia_id' => \App\Models\Competencia::factory(),
            'nombre_juzgado' => 'Juzgado de '.ucfirst($this->faker->word()).' N° '.$this->faker->numberBetween(1, 10),
        ];
    }
}
