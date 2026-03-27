<?php

namespace Database\Factories;

use App\Models\TemplateCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Template>
 */
class TemplateFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'template_category_id' => TemplateCategory::factory(),
            'title' => $this->faker->sentence(3),
            'content' => $this->faker->paragraphs(3, true),
        ];
    }
}
