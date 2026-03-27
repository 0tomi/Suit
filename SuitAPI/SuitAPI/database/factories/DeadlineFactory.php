<?php

namespace Database\Factories;

use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Deadline>
 */
class DeadlineFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'title' => fake()->sentence(3),
            'description' => fake()->optional()->sentence(),
            'due_date' => fake()->dateTimeBetween('now', '+3 months')->format('Y-m-d'),
            'priority' => 'Normal',
            'manually_urgent' => false,
            'status' => 'Pendiente',
        ];
    }

    /** State: vencimiento que ya venció. */
    public function overdue(): static
    {
        return $this->state(fn () => [
            'due_date' => fake()->dateTimeBetween('-1 month', 'yesterday')->format('Y-m-d'),
            'status' => 'Vencido',
        ]);
    }

    /** State: vencimiento cumplido. */
    public function completed(): static
    {
        return $this->state(fn () => [
            'status' => 'Cumplido',
        ]);
    }

    /** State: vencimiento próximo (en los próximos 2 días). */
    public function imminent(): static
    {
        return $this->state(fn () => [
            'due_date' => now()->addDay()->format('Y-m-d'),
        ]);
    }

    /** State: vencimiento marcado manualmente como Urgente. */
    public function urgent(): static
    {
        return $this->state(fn () => [
            'priority' => 'Urgente',
            'manually_urgent' => true,
        ]);
    }
}
