<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class TemplateCategoriesTableSeeder extends Seeder
{
    /**
     * Auto generated seed file
     *
     * @return void
     */
    public function run()
    {

        \DB::table('template_categories')->delete();

    }
}
