<?php

namespace Database\Factories;

use App\Models\Gasto;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\GastoSuitCase>
 */
class GastoSuitCaseFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'gasto_id' => Gasto::factory(),
            'suit_case_id' => SuitCase::factory(),
            'user_id' => User::factory(),
            'monto' => $this->faker->randomFloat(2, 50, 5000),
            'created_at' => $this->faker->dateTimeBetween('-6 months', 'now'),
        ];
    }
}
