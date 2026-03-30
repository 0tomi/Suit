<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Client>
 */
class ClientFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => $this->faker->randomElement(['person', 'company']),
            'financial_status' => $this->faker->randomElement(['no deudor', 'deudor', 'moroso']),
            'persona_id' => \App\Models\Persona::factory(),
        ];
    }
}
