<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Models\File;
use App\Models\Multimedia;
use App\Models\Tombstone;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CleanupDeletedFiles extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:cleanup-deleted-files';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Permanently delete soft-deleted files and their physical records after the configured grace period.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $days = config('suitapi.cleanup_days', 30);
        $threshold = now()->subDays($days);

        $this->info("Cleaning up files deleted before {$threshold->toDateTimeString()} ({$days} days retention)...");

        // 1. Process Multimedia
        $this->cleanupGenericFiles(Multimedia::class, 'multimedia', $threshold);

        // 2. Process General Files
        $this->cleanupGenericFiles(File::class, 'file', $threshold);

        // 3. Process Documents (Complex because of versions)
        $this->cleanupDocuments($threshold);

        $this->info('Cleanup completed successfully.');

        return 0;
    }

    protected function cleanupGenericFiles(string $modelClass, string $type, $threshold)
    {
        $records = $modelClass::onlyTrashed()
            ->where('deleted_at', '<', $threshold)
            ->get();

        if ($records->isEmpty()) {
            return;
        }

        $this->comment("Found {$records->count()} deleted {$type} records to purge.");

        foreach ($records as $record) {
            DB::transaction(function () use ($record, $type) {
                // Delete physical file
                if (Storage::disk('local')->exists($record->path)) {
                    Storage::disk('local')->delete($record->path);
                }

                // Record tombstone for sync
                Tombstone::record($type, $record->id);

                // Force delete record
                $record->forceDelete();
            });
        }
    }

    protected function cleanupDocuments($threshold)
    {
        $documents = Document::onlyTrashed()
            ->where('deleted_at', '<', $threshold)
            ->with('versions')
            ->get();

        if ($documents->isEmpty()) {
            return;
        }

        $this->comment("Found {$documents->count()} deleted documents to purge.");

        foreach ($documents as $document) {
            DB::transaction(function () use ($document) {
                // Delete all version files
                foreach ($document->versions as $version) {
                    if (Storage::disk('local')->exists($version->file_path)) {
                        Storage::disk('local')->delete($version->file_path);
                    }
                    // Versions are hard-deleted automatically if document is force-deleted
                    // but we might want to be explicit or let cascade work.
                }

                // Record tombstone for sync
                Tombstone::record('document', $document->id);

                // Force delete document (this should cascade to versions if set up,
                // or we force delete versions first)
                $document->forceDelete();
            });
        }
    }
}
