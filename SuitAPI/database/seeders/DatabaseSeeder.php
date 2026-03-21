<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        // User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);

        Schema::disableForeignKeyConstraints();

        $this->call(UsersTableSeeder::class);
        $this->call(RolSeeder::class);
        $this->call(ClientsTableSeeder::class);
        $this->call(CaseTypesTableSeeder::class);
        $this->call(RadicacionSeeder::class);
        $this->call(SuitCasesTableSeeder::class);
        $this->call(AgendasTableSeeder::class);
        $this->call(EventTypesTableSeeder::class);
        $this->call(EventsTableSeeder::class);
        $this->call(CasePermissionsTableSeeder::class);
        $this->call(CaseClientTableSeeder::class);
        $this->call(DocumentsTableSeeder::class);
        $this->call(DocumentClientTableSeeder::class);
        $this->call(DocumentVersionsTableSeeder::class);
        $this->call(ImagesTableSeeder::class);
        $this->call(VideosTableSeeder::class);
        $this->call(TemplateCategoriesTableSeeder::class);
        $this->call(TemplatesTableSeeder::class);
        $this->call(EventNotificationsTableSeeder::class);
        $this->call(AgendaUserTableSeeder::class);

        $this->call(TipoPagoSeeder::class);
        $this->call(GastoSeeder::class);
        $this->call(TipoExpedienteSeeder::class);
        $this->call(PublicFileCatalogSeeder::class);

        Schema::enableForeignKeyConstraints();
    }
}
