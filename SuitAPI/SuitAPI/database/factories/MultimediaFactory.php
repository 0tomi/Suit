<?php

namespace Database\Factories;

use App\Models\Multimedia;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Multimedia>
 */
class MultimediaFactory extends Factory
{
    protected $model = Multimedia::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'filename' => $this->faker->word.'.mp4',
            'path' => 'secure_media/'.Str::uuid(),
            'hash' => hash('sha256', 'fake-media-content'),
            'mime_type' => 'video/mp4',
            'size' => $this->faker->numberBetween(1000, 5000000),
            'encryption_iv' => base64_encode(random_bytes(16)),
            'suit_case_id' => SuitCase::factory(),
            'user_id' => User::factory(),
        ];
    }
}
