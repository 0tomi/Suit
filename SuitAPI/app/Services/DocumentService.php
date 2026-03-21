<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class DocumentService
{
    protected string $storageDisk = 'local';

    protected string $storagePath = 'secure_docs';

    public function __construct(protected FileEncryptionService $encryptionService) {}

    /**
     * Create a new document with initial version.
     */
    public function createDocument(array $data, UploadedFile $file, User $user): Document
    {
        return DB::transaction(function () use ($data, $file, $user) {
            // Create Document
            $document = Document::create([
                'name' => $data['name'],
                'user_id' => $user->id,
                'suit_case_id' => $data['suit_case_id'] ?? null,
                'event_id' => $data['event_id'] ?? null,
                'category' => 'document', // Always document for this table now
            ]);

            // Create Version 1
            $this->createVersion($document, $file, $user);

            return $document;
        });
    }

    /**
     * Create a new version for an existing document.
     */
    public function createVersion(Document $document, UploadedFile $file, User $user): DocumentVersion
    {
        $content = $this->readFileContent($file);
        $checksum = hash('sha256', $content);
        $mimeType = $this->resolveMimeType($file);

        // Encrypt using shared service
        $encryptionResult = $this->encryptionService->encrypt($content);

        // Determine next version number
        $latestVersion = $document->latestVersion;
        $versionNumber = $latestVersion ? $latestVersion->version_number + 1 : 1;

        // Generate unique file path
        $fileIdentifier = (string) Str::uuid();
        $filePath = $this->storagePath.'/'.$fileIdentifier;

        // Store file
        Storage::disk($this->storageDisk)->put($filePath, $encryptionResult['content']);

        $version = DocumentVersion::create([
            'document_id' => $document->id,
            'version_number' => $versionNumber,
            'file_path' => $filePath,
            'mime_type' => $mimeType,
            'size' => $file->getSize(),
            'encryption_iv' => $encryptionResult['iv'],
            'checksum' => $checksum,
            'created_by' => $user->id,
        ]);

        return $version;
    }

    /**
     * Alias for createVersion for compatibility with controllers.
     */
    public function createVersionExplicitIV(Document $document, UploadedFile $file, User $user): DocumentVersion
    {
        return $this->createVersion($document, $file, $user);
    }

    /**
     * Retrieve and decrypt file content.
     */
    public function getFileContent(DocumentVersion $version): string
    {
        if (! Storage::disk($this->storageDisk)->exists($version->file_path)) {
            throw new RuntimeException('File not found in storage.');
        }

        $encryptedContent = Storage::disk($this->storageDisk)->get($version->file_path);

        // Decrypt using shared service
        $decryptedContent = $this->encryptionService->decrypt($encryptedContent, $version->encryption_iv);

        // Verify Integrity
        $currentChecksum = hash('sha256', $decryptedContent);
        if ($currentChecksum !== $version->checksum) {
            throw new RuntimeException('Posible corrupción o manipulación de datos');
        }

        return $decryptedContent;
    }

    /**
     * Delete document (soft delete).
     * Physical files should ONLY be deleted in forceDelete.
     */
    public function deleteDocument(Document $document): void
    {
        // For soft delete, we just call delete() on the model.
        // The cleanup command will handle forceDelete and physical removal.
        $document->delete();
    }

    /**
     * Helper to lock the document.
     */
    public function lockDocument(Document $document, User $user): bool
    {
        return $document->lock($user);
    }

    /**
     * Helper to unlock the document.
     */
    public function unlockDocument(Document $document, User $user): bool
    {
        return $document->unlock($user);
    }

    protected function readFileContent(UploadedFile $file): string
    {
        $path = $file->getRealPath() ?: $file->getPathname();
        $stream = fopen($path, 'rb');

        if ($stream === false) {
            throw new RuntimeException('Unable to read uploaded file.');
        }

        try {
            $content = stream_get_contents($stream);
        } finally {
            fclose($stream);
        }

        if ($content === false) {
            throw new RuntimeException('Unable to read uploaded file.');
        }

        return $content;
    }

    protected function resolveMimeType(UploadedFile $file): string
    {
        return $file->getMimeType() ?? $file->getClientMimeType() ?? 'application/octet-stream';
    }
}
