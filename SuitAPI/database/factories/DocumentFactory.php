<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Document>
 */
class DocumentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->word.'.pdf',
            'category' => 'document',
            'user_id' => \App\Models\User::factory(),
            'suit_case_id' => \App\Models\SuitCase::factory(),
            'is_locked' => false,
        ];
    }
}
