<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Honorario>
 */
class HonorarioFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'suit_case_id' => SuitCase::factory(),
            'client_id' => Client::factory(),
            'user_id' => User::factory(),
            'monto' => $this->faker->randomFloat(2, 1000, 50000),
            'detalles' => $this->faker->sentence(),
            'pagado' => false,
            'created_at' => $this->faker->dateTimeBetween('-6 months', 'now'),
        ];
    }
}
