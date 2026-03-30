<?php

namespace App\Console\Commands;

use App\Models\Client;
use Illuminate\Console\Command;

class SyncClientStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'clients:sync-status';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sincroniza el estado de los clientes (Activo/Inactivo) y su estado financiero (No Deudor/Deudor/Moroso) de forma masiva.';

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $this->info('Iniciando sincronización de estados de clientes...');

        $clients = Client::all();
        $bar = $this->output->createProgressBar(count($clients));

        $bar->start();

        foreach ($clients as $client) {
            $client->recalculateStatus();
            $client->recalculateFinancialStatus();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Sincronización completada con éxito.');
    }
}
