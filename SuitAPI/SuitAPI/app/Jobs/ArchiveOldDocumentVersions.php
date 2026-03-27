<?php

namespace App\Jobs;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Services\DocumentArchiveService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ArchiveOldDocumentVersions implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    /** Maximum number of attempts before giving up. */
    public int $tries = 3;

    /**
     * @param  Document  $document  The document being versioned.
     * @param  DocumentVersion  $newVersion  The version just created (now the latest).
     * @param  DocumentVersion  $oldVersion  The version that was the latest before this save.
     */
    public function __construct(
        public Document $document,
        public DocumentVersion $newVersion,
        public DocumentVersion $oldVersion,
    ) {
        // Route to the dedicated documents queue.
        $this->onQueue('documents');
    }

    public function handle(DocumentArchiveService $archiveService): void
    {
        $archiveService->archivePreviousVersion($this->oldVersion, $this->newVersion);
    }
}
