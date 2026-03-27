<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentArchiveSession;
use App\Models\DocumentVersion;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Manages the lifecycle of compressed, encrypted document version archives.
 *
 * Format: files are packed using PHP serialize(), compressed with gzcompress()
 * (ext/zlib — no extra install required), then encrypted with AES-256-CBC.
 * No ext/zip or temp files on disk are needed.
 *
 * Archive layout on disk (for a document at version N):
 *   secure_docs/{uuid-vN}          ← current version, individually encrypted
 *   secure_docs/{uuid-vN}.arch     ← gzcompressed + encrypted pack of v1..vN-1
 *   secure_docs/{uuid-vN}.arch.iv  ← AES IV for the .arch file
 */
class DocumentArchiveService
{
    protected string $storageDisk = 'local';

    protected string $storagePath = 'secure_docs';

    protected string $sessionsPath = 'secure_docs/sessions';

    public function __construct(protected FileEncryptionService $encryptionService) {}

    // -------------------------------------------------------------------------
    // Path helpers
    // -------------------------------------------------------------------------

    /** Derive the .arch path from the latest version's file_path. */
    public function archivePathFor(string $latestFilePath): string
    {
        return $latestFilePath.'.arch';
    }

    /** Returns true if a .arch file exists for the given latest file path. */
    public function archiveExists(string $latestFilePath): bool
    {
        return Storage::disk($this->storageDisk)->exists($this->archivePathFor($latestFilePath));
    }

    /** Temporary extraction directory for a specific document. */
    public function extractedPathFor(int $documentId): string
    {
        return $this->sessionsPath.'/'.$documentId;
    }

    // -------------------------------------------------------------------------
    // Archiving (write path — called from the Job)
    // -------------------------------------------------------------------------

    /**
     * Archive the previous "latest" version into the .arch file.
     *
     * Called by ArchiveOldDocumentVersions after vN has been saved. Steps:
     *  1. Decrypt the individual file of vN-1 (the old latest).
     *  2. Decrypt + unpack the existing .arch (contains v1..vN-2), if present.
     *  3. Add vN-1 to the set → gzcompress + encrypt → save as {vN.file_path}.arch.
     *  4. Delete vN-1's individual file and the old .arch.
     *  5. Invalidate any active extraction session.
     */
    public function archivePreviousVersion(DocumentVersion $oldLatest, DocumentVersion $newLatest): void
    {
        $disk = Storage::disk($this->storageDisk);

        if (! $disk->exists($oldLatest->file_path)) {
            // Already archived (job retry after partial execution).
            return;
        }

        // 1. Decrypt the old individual version file.
        $oldContent = $this->encryptionService->decrypt(
            $disk->get($oldLatest->file_path),
            $oldLatest->encryption_iv
        );

        // 2. Collect all files to pack: start with the old latest.
        $filesToPack = [basename($oldLatest->file_path) => $oldContent];

        // If an existing .arch is present, decrypt + unpack it to recover v1..vN-2.
        $oldArchivePath = $this->archivePathFor($oldLatest->file_path);
        if ($disk->exists($oldArchivePath) && $disk->exists($oldArchivePath.'.iv')) {
            $archiveIv = $disk->get($oldArchivePath.'.iv');
            $existingFiles = $this->decryptAndUnpack($disk->get($oldArchivePath), $archiveIv);
            // Merge: existing files first, then old latest (preserves chronological order).
            $filesToPack = array_merge($existingFiles, $filesToPack);
        }

        // 3. Pack → compress → encrypt → persist as the new .arch.
        $newArchivePath = $this->archivePathFor($newLatest->file_path);
        $encrypted = $this->encryptionService->encrypt($this->packFiles($filesToPack));

        $disk->put($newArchivePath, $encrypted['content']);
        $disk->put($newArchivePath.'.iv', $encrypted['iv']);

        // 4. Delete the old individual file and old .arch.
        $disk->delete($oldLatest->file_path);
        if ($disk->exists($oldArchivePath)) {
            $disk->delete($oldArchivePath);
            $disk->delete($oldArchivePath.'.iv');
        }

        // 5. Invalidate any active extraction session so stale files don't linger.
        $this->invalidateSession($oldLatest->document_id);
    }

    // -------------------------------------------------------------------------
    // Extraction (read path — called when a historical version is requested)
    // -------------------------------------------------------------------------

    /**
     * Ensure the archive is extracted and return the path to the session directory.
     * If an active session exists, the TTL window is renewed and the path is returned.
     */
    public function ensureExtracted(Document $document, string $archivePath): string
    {
        $session = DocumentArchiveSession::where('document_id', $document->id)->first();

        if ($session && $session->isActive()) {
            $session->update(['keep_until' => now()->addMinutes(config('documents.session_ttl_minutes'))]);

            return $session->extracted_path;
        }

        return $this->extractArchive($document, $archivePath);
    }

    /**
     * Decrypt + unpack the .arch into the session directory and register the session.
     */
    public function extractArchive(Document $document, string $archivePath): string
    {
        $disk = Storage::disk($this->storageDisk);

        if (! $disk->exists($archivePath)) {
            throw new RuntimeException('Archive file not found: '.$archivePath);
        }
        if (! $disk->exists($archivePath.'.iv')) {
            throw new RuntimeException('Archive IV file not found.');
        }

        $iv = $disk->get($archivePath.'.iv');
        $decryptedPack = $this->encryptionService->decrypt($disk->get($archivePath), $iv);

        $extractedPath = $this->extractedPathFor($document->id);
        $this->unpackToStorage($decryptedPack, $extractedPath);

        DocumentArchiveSession::updateOrCreate(
            ['document_id' => $document->id],
            [
                'extracted_path' => $extractedPath,
                'archive_path' => $archivePath,
                'keep_until' => now()->addMinutes(config('documents.session_ttl_minutes')),
            ]
        );

        return $extractedPath;
    }

    /**
     * Read a specific historical version's content from the active session directory.
     */
    public function readExtractedVersion(string $extractedPath, DocumentVersion $version): string
    {
        $fileName = basename($version->file_path);
        $filePath = $extractedPath.'/'.$fileName;

        if (! Storage::disk($this->storageDisk)->exists($filePath)) {
            throw new RuntimeException('Version file not found in extracted session.');
        }

        $content = Storage::disk($this->storageDisk)->get($filePath);

        if (hash('sha256', $content) !== $version->checksum) {
            throw new RuntimeException('Posible corrupción o manipulación de datos');
        }

        return $content;
    }

    // -------------------------------------------------------------------------
    // Session cleanup (called by CleanupDocumentArchives command)
    // -------------------------------------------------------------------------

    /**
     * Delete extracted session directories and records whose keep_until has passed.
     * Returns the number of sessions cleaned up.
     */
    public function cleanupExpiredSessions(): int
    {
        $sessions = DocumentArchiveSession::expired()->get();
        $count = 0;

        foreach ($sessions as $session) {
            /** @var DocumentArchiveSession $session */
            $this->deleteExtractedDirectory($session->extracted_path);
            $session->delete();
            $count++;
        }

        return $count;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Pack an array of [filename => content] into a compressed binary string.
     *
     * Uses serialize() (core PHP) + gzcompress() (ext/zlib).
     * ext/zlib is a default library in static-php-cli builds (used by FrankenPHP)
     * and is always present when ext/openssl is active (they share libssl→zlib).
     * Level 6 is a good balance between speed and ratio for similar HTML content.
     */
    private function packFiles(array $files): string
    {
        $compressed = gzcompress(serialize($files), 6);

        if ($compressed === false) {
            throw new RuntimeException('gzcompress failed. Verify ext/zlib is enabled.');
        }

        return $compressed;
    }

    /**
     * Unpack a binary string produced by packFiles() back into [filename => content].
     */
    private function unpackFiles(string $packed): array
    {
        $decompressed = gzuncompress($packed);

        if ($decompressed === false) {
            throw new RuntimeException('gzuncompress failed. Archive may be corrupted.');
        }

        return unserialize($decompressed);
    }

    /**
     * Decrypt an .arch blob and unpack its contents.
     *
     * @param  string  $iv  The IV read from the adjacent .arch.iv file.
     */
    private function decryptAndUnpack(string $encryptedPack, string $iv): array
    {
        $decrypted = $this->encryptionService->decrypt($encryptedPack, $iv);

        return $this->unpackFiles($decrypted);
    }

    /** Unpack a binary string and write each file into the Storage disk. */
    private function unpackToStorage(string $packed, string $extractedPath): void
    {
        $files = $this->unpackFiles($packed);
        $disk = Storage::disk($this->storageDisk);

        foreach ($files as $filename => $content) {
            $disk->put($extractedPath.'/'.$filename, $content);
        }
    }

    /** Delete all files in an extracted session directory, then remove the directory. */
    private function deleteExtractedDirectory(string $extractedPath): void
    {
        $disk = Storage::disk($this->storageDisk);
        foreach ($disk->files($extractedPath) as $file) {
            $disk->delete($file);
        }
        $disk->deleteDirectory($extractedPath);
    }

    /** Remove the active extraction session for a document (e.g. after a new version is archived). */
    private function invalidateSession(int $documentId): void
    {
        $session = DocumentArchiveSession::where('document_id', $documentId)->first();

        if (! $session) {
            return;
        }

        $this->deleteExtractedDirectory($session->extracted_path);
        $session->delete();
    }
}
