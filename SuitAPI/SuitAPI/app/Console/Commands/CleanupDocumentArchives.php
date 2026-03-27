<?php

namespace App\Console\Commands;

use App\Services\DocumentArchiveService;
use Illuminate\Console\Command;

class CleanupDocumentArchives extends Command
{
    protected $signature = 'documents:cleanup-archives';

    protected $description = 'Delete temporarily extracted historical version files whose TTL has expired.';

    public function handle(DocumentArchiveService $archiveService): int
    {
        $count = $archiveService->cleanupExpiredSessions();

        if ($count > 0) {
            $this->info("Cleaned up {$count} expired archive session(s).");
        }

        return Command::SUCCESS;
    }
}
