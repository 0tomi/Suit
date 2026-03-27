<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Event>
 */
class EventFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'agenda_id' => \App\Models\Agenda::factory(),
            'event_type_id' => \App\Models\EventType::factory(),
            'title' => $this->faker->sentence(),
            'description' => $this->faker->paragraph(),
            'starts_at' => $this->faker->dateTimeBetween('now', '+1 year'),
            'is_all_day' => $this->faker->boolean(),
            'suit_case_id' => null,
        ];
    }
}
