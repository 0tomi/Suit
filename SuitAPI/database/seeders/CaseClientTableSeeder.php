<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class CaseClientTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('case_client')->delete();

        \DB::table('case_client')->insert([
            0 => [
                'id' => 1,
                'suit_case_id' => 1,
                'client_id' => 1,
                'created_at' => '2026-02-11 19:46:28',
                'updated_at' => '2026-02-11 19:46:28',
            ],
        ]);

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('case_client', 'id'), COALESCE((SELECT MAX(id) FROM case_client), 1))");
        }

    }
}
