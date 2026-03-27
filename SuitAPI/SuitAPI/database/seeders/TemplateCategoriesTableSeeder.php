<?php

namespace Database\Seeders;

use App\Models\TemplateCategory;
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
        $categories = [
            ['name' => 'General', 'description' => 'Categoría general por defecto'],
            ['name' => 'Contratos', 'description' => 'Contratos civiles, comerciales y laborales'],
            ['name' => 'Escritos Judiciales', 'description' => 'Demandas, contestaciones y escritos de mero trámite'],
            ['name' => 'Cartas Documento', 'description' => 'Notificaciones extrajudiciales formales'],
            ['name' => 'Actas y Certificados', 'description' => 'Actas de reunión, asamblea o certificaciones'],
        ];

        foreach ($categories as $category) {
            TemplateCategory::updateOrCreate(['name' => $category['name']], $category);
        }
    }
}
