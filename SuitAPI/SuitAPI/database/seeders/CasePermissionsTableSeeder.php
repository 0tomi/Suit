<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class CasePermissionsTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('case_permissions')->delete();

    }
}
