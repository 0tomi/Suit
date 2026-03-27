<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PublicFile>
 */
class PublicFileFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $fileName = $this->faker->word.'.txt';
        $uuid = Str::uuid();
        $path = 'public_files/'.$uuid.'.txt';

        return [
            'uuid' => $uuid,
            'user_id' => User::factory(),
            'name' => $fileName,
            'path' => $path,
            'mime_type' => 'text/plain',
            'size' => $this->faker->numberBetween(100, 10000),
            'hash' => $this->faker->sha256,
        ];
    }
}
