<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DocumentsTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('documents')->delete();

        \DB::table('documents')->insert([
            0 => [
                'id' => 1,
                'name' => 'FixedDoc3',
                'user_id' => 1,
                'suit_case_id' => null,
                'event_id' => null,
                'is_locked' => 1,
                'locked_by' => 1,
                'locked_at' => '2026-02-24 18:34:20',
                'created_at' => '2026-02-06 20:01:56',
                'updated_at' => '2026-02-24 18:34:20',
            ],
            1 => [
                'id' => 2,
                'name' => 'Test Document',
                'user_id' => 4,
                'suit_case_id' => null,
                'event_id' => null,
                'is_locked' => 1,
                'locked_by' => 4,
                'locked_at' => '2026-03-06 20:51:46',
                'created_at' => '2026-02-26 19:40:02',
                'updated_at' => '2026-03-06 20:51:46',
            ],
        ]);

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('documents', 'id'), COALESCE((SELECT MAX(id) FROM documents), 1))");
        }

    }
}
