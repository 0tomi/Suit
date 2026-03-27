<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Bitacora>
 */
class BitacoraFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'action' => $this->faker->randomElement(['created', 'updated', 'deleted']),
            'entity_id' => $this->faker->randomNumber(),
            'entity_type' => $this->faker->randomElement(array_keys(\App\Models\Bitacora::ENTITY_MAPPING)),
        ];
    }
}
