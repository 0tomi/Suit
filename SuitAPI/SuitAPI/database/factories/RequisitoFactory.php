<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Requisito>
 */
class RequisitoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => $this->faker->randomElement([
                'caseType', 'dependencia', 'clientCompleteName', 'date', 'text',
                'caseNumber', 'userCompleteName', 'clientIdentification', 'amount',
            ]),
            'title' => $this->faker->word(),
        ];
    }
}
