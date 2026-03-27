<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        Setting::set('deadline_urgency_days', '2');

        Setting::query()->where('key', 'deadline_urgency_days')->update([
            'description' => 'Días antes del vencimiento en que la prioridad se eleva automáticamente a Urgente.',
        ]);
    }
}
