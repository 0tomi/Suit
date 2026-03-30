<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupAiConversations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'suitapi:cleanup-ai {--days=30 : Antigüedad mínima en días para eliminar (def: 30)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Elimina conversaciones de IA antiguas del Chatbot';

    /**
     * Execute the console command.
     */
    public function handle(\App\Services\HtmlSimplifierService $simplifier): int
    {
        $days = (int) $this->option('days');

        $this->info("Iniciando limpieza de conversaciones de IA con más de {$days} días...");

        $deletedCount = $simplifier->cleanupOldConversations($days);

        if ($deletedCount > 0) {
            $this->info("Se eliminaron con éxito {$deletedCount} conversaciones.");
        } else {
            $this->info('No se encontraron conversaciones que requieran limpieza.');
        }

        return self::SUCCESS;
    }
}
