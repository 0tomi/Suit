<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\EventType>
 */
class EventTypeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->randomElement([
                'Vencimiento', 'Audiencia', 'Reunión', 'Trámite', 'Llamado',
                'Conferencia', 'Consulta', 'Mediación', 'Pericia', 'Vista de causa',
            ]),
            'color' => $this->faker->safeHexColor(),
        ];
    }
}
