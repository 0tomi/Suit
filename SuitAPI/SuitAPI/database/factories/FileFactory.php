<?php

namespace Database\Factories;

use App\Models\File;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\File>
 */
class FileFactory extends Factory
{
    protected $model = File::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'filename' => $this->faker->word.'.pdf',
            'path' => 'secure_files/'.Str::uuid(),
            'hash' => hash('sha256', 'fake-content'),
            'mime_type' => 'application/pdf',
            'size' => $this->faker->numberBetween(1000, 5000000),
            'encryption_iv' => base64_encode(random_bytes(16)),
            'suit_case_id' => SuitCase::factory(),
            'user_id' => User::factory(),
        ];
    }
}
