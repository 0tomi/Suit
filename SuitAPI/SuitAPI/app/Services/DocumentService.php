<?php

namespace App\Services;

use App\Jobs\ArchiveOldDocumentVersions;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class DocumentService
{
    protected string $storageDisk = 'local';

    protected string $storagePath = 'secure_docs';

    public function __construct(
        protected FileEncryptionService $encryptionService,
        protected DocumentArchiveService $archiveService,
    ) {}

    /**
     * Create a new document with its initial version from HTML string content.
     */
    public function createDocument(array $data, string $htmlContent, User $user): Document
    {
        return DB::transaction(function () use ($data, $htmlContent, $user) {
            $document = Document::create([
                'name' => $data['name'],
                'user_id' => $user->id,
                'suit_case_id' => $data['suit_case_id'] ?? null,
                'event_id' => $data['event_id'] ?? null,
                'status' => $data['status'] ?? 'Borrador',
                'category' => 'document',
            ]);

            $this->createVersionFromString($document, $htmlContent, $user);

            return $document;
        });
    }

    /**
     * Create a new version for an existing document from HTML string content.
     *
     * After persisting the new version, if a previous version exists it
     * dispatches a background job to compress and encrypt the old version
     * into the .arch file — so the caller is never blocked by that work.
     */
    public function createVersionFromString(Document $document, string $htmlContent, User $user): DocumentVersion
    {
        return DB::transaction(function () use ($document, $htmlContent, $user) {
            // Bloquear el documento para evitar lecturas concurrentes conflictivas del número de versión.
            $document->lockForUpdate();

            $checksum = hash('sha256', $htmlContent);
            $encryptionResult = $this->encryptionService->encrypt($htmlContent);

            // Capturar la última versión actual después de obtener el bloqueo.
            $previousLatest = $document->latestVersion()->first();
            $versionNumber = $previousLatest ? $previousLatest->version_number + 1 : 1;

            $filePath = $this->storagePath.'/'.Str::uuid();
            Storage::disk($this->storageDisk)->put($filePath, $encryptionResult['content']);

            $newVersion = DocumentVersion::create([
                'document_id' => $document->id,
                'version_number' => $versionNumber,
                'file_path' => $filePath,
                'mime_type' => 'text/html',
                'size' => strlen($htmlContent),
                'encryption_iv' => $encryptionResult['iv'],
                'checksum' => $checksum,
                'created_by' => $user->id,
            ]);

            if ($previousLatest) {
                ArchiveOldDocumentVersions::dispatch($document, $newVersion, $previousLatest);
            }

            return $newVersion;
        });
    }

    /**
     * Retrieve and decrypt file content for a given version.
     *
     * Decision tree:
     *  1. If the individual file exists on disk → it's the current latest; read directly.
     *  2. Otherwise → the file was archived; delegate to the archive service.
     */
    public function getFileContent(DocumentVersion $version): string
    {
        $disk = Storage::disk($this->storageDisk);

        if ($disk->exists($version->file_path)) {
            return $this->readAndVerifyDirectFile($version);
        }

        // File no longer exists individually — it has been moved into the .arch.
        return $this->getHistoricalVersionContent($version);
    }

    /**
     * Read a historical version from the (possibly cached) extraction session.
     */
    public function getHistoricalVersionContent(DocumentVersion $version): string
    {
        /** @var Document $document */
        $document = $version->document;

        // The archive path is always derived from the *current* latest version's file path.
        $latestVersion = $document->latestVersion;
        if (! $latestVersion) {
            throw new RuntimeException('Document has no latest version.');
        }

        $archivePath = $this->archiveService->archivePathFor($latestVersion->file_path);

        $extractedPath = $this->archiveService->ensureExtracted($document, $archivePath);

        return $this->archiveService->readExtractedVersion($extractedPath, $version);
    }

    /**
     * Delete document (soft delete).
     * Physical files are cleaned up on forceDelete via a separate process.
     */
    public function deleteDocument(Document $document): void
    {
        $document->delete();
    }

    public function lockDocument(Document $document, User $user): bool
    {
        return $document->lock($user);
    }

    public function unlockDocument(Document $document, User $user): bool
    {
        return $document->unlock($user);
    }

    /** Read and integrity-check a directly accessible (latest) version file. */
    private function readAndVerifyDirectFile(DocumentVersion $version): string
    {
        $encryptedContent = Storage::disk($this->storageDisk)->get($version->file_path);
        $decryptedContent = $this->encryptionService->decrypt($encryptedContent, $version->encryption_iv);

        if (hash('sha256', $decryptedContent) !== $version->checksum) {
            throw new RuntimeException('Posible corrupción o manipulación de datos');
        }

        return $decryptedContent;
    }
}
