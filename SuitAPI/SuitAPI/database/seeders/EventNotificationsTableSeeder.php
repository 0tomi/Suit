<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class EventNotificationsTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('event_notifications')->delete();

        \DB::table('event_notifications')->insert([
            0 => [
                'event_id' => 49,
                'user_id' => 1,
                'when_to_notify_minutes' => 15,
                'created_at' => '2026-03-04 20:53:24',
                'updated_at' => '2026-03-04 20:53:24',
            ],
        ]);

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('event_notifications', 'id'), COALESCE((SELECT MAX(id) FROM event_notifications), 1))");
        }

    }
}
