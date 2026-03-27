<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DocumentClientTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('document_client')->delete();

        \DB::table('document_client')->insert([
            0 => [
                'id' => 1,
                'document_id' => 1,
                'client_id' => 1,
                'created_at' => '2026-02-11 19:51:01',
                'updated_at' => '2026-02-11 19:51:01',
            ],
        ]);

        // Reset PostgreSQL sequence to max id
        if (\Illuminate\Support\Facades\DB::getDriverName() === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement("SELECT setval(pg_get_serial_sequence('document_client', 'id'), COALESCE((SELECT MAX(id) FROM document_client), 1))");
        }

    }
}
