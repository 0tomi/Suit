<?php

namespace Database\Factories;

use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SuitCaseFactory extends Factory
{
    protected $model = SuitCase::class;

    public function definition()
    {
        return [
            'title' => $this->faker->sentence,
            'lawyer_id' => User::factory(),
            'status' => 'active',
            'case_type_id' => \App\Models\CaseType::factory(),
            'start_date' => now(),
            'end_date' => now()->addYear(),
            'details' => $this->faker->paragraph,
            'nro_expediente' => $this->faker->numerify('EXT-####/##'),
            'radicacion_id' => \App\Models\Radicacion::factory(),
        ];
    }
}
