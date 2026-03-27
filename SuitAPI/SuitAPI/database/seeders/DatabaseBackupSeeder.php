<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DatabaseBackupSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $backupFile = database_path('seeders/backup_data.json');

        if (! file_exists($backupFile)) {
            $this->command->error('The backup_data.json file was not found.');

            return;
        }

        $json = file_get_contents($backupFile);
        $data = json_decode($json, true);

        if (! is_array($data)) {
            $this->command->error('Could not parse JSON data.');

            return;
        }

        // Disable foreign key constraints if needed
        Schema::disableForeignKeyConstraints();

        $tableOrder = [
            'users',
            'case_types',
            'clients',
            'suit_cases',
            'case_client',
            'agendas',
            'events',
            'documents',
            'document_versions',
            'document_client',
            'personal_access_tokens',
            'cache',
        ];

        $tables = array_keys($data);

        // Sort tables so parent tables are inserted first
        usort($tables, function ($a, $b) use ($tableOrder) {
            $posA = array_search($a, $tableOrder);
            $posB = array_search($b, $tableOrder);
            $posA = $posA === false ? 999 : $posA;
            $posB = $posB === false ? 999 : $posB;

            return $posA <=> $posB;
        });

        // Loop through each table and clear them in reverse order
        foreach (array_reverse($tables) as $table) {
            $this->command->info("Clearing table: {$table}");
            try {
                DB::table($table)->truncate();
            } catch (\Exception $e) {
                DB::table($table)->delete();
            }
        }

        // Loop through each table and insert data
        foreach ($tables as $table) {
            $rows = $data[$table];
            $this->command->info("Seeding table: {$table}");

            // Insert in chunks to avoid memory/query size limits
            $chunks = array_chunk($rows, 100);
            foreach ($chunks as $chunk) {
                // Convert stdClass/array to pure associative arrays
                $insertData = array_map(function ($item) {
                    return (array) $item;
                }, $chunk);

                DB::table($table)->insert($insertData);
            }

            // Update sequences for PostgreSQL if the table has an auto-incrementing id
            if (DB::connection()->getDriverName() === 'pgsql' && Schema::hasColumn($table, 'id')) {
                $seq = DB::scalar("SELECT pg_get_serial_sequence('{$table}', 'id')");
                if ($seq) {
                    DB::statement("SELECT setval('{$seq}', coalesce(max(id), 1), max(id) IS NOT null) FROM \"{$table}\"");
                }
            }
        }

        Schema::enableForeignKeyConstraints();

        $this->command->info('Database restored from backup_data.json successfully!');
    }
}
