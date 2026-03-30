<?php

namespace App\Services;

use App\Models\File;
use App\Models\Multimedia;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class FileService
{
    protected string $storageDisk = 'local';

    protected string $multimediaPath = 'secure_media';

    protected string $filePath = 'secure_files';

    public function __construct(protected FileEncryptionService $encryptionService) {}

    /**
     * Store a multimedia file.
     */
    public function storeMultimedia(UploadedFile $file, array $data, User $user): Multimedia
    {
        return $this->store($file, $data, $user, Multimedia::class, $this->multimediaPath);
    }

    /**
     * Store a general file.
     */
    public function storeFile(UploadedFile $file, array $data, User $user): File
    {
        return $this->store($file, $data, $user, File::class, $this->filePath);
    }

    /**
     * Internal generic store logic.
     */
    protected function store(UploadedFile $file, array $data, User $user, string $modelClass, string $storageFolder): Model
    {
        $realPath = $file->getRealPath() ?: $file->getPathname();

        // Use hash_file for streaming hash calculation (more memory efficient)
        $checksum = hash_file('sha256', $realPath);
        $mimeType = $file->getMimeType() ?? $file->getClientMimeType() ?? 'application/octet-stream';

        // Read once for encryption
        $content = file_get_contents($realPath);
        if ($content === false) {
            throw new RuntimeException('Unable to read uploaded file.');
        }

        // Encrypt content
        $encryptionResult = $this->encryptionService->encrypt($content);

        // Generate unique file path
        $fileIdentifier = (string) Str::uuid();
        $path = $storageFolder.'/'.$fileIdentifier;

        // Store encrypted file
        Storage::disk($this->storageDisk)->put($path, $encryptionResult['content']);

        return $modelClass::create([
            'filename' => $file->getClientOriginalName(),
            'path' => $path,
            'hash' => $checksum,
            'mime_type' => $mimeType,
            'size' => $file->getSize(),
            'encryption_iv' => $encryptionResult['iv'],
            'suit_case_id' => $data['suit_case_id'] ?? null,
            'user_id' => $user->id,
        ]);
    }

    /**
     * Retrieve and decrypt file content.
     */
    public function getFileContent(Multimedia|File $model): string
    {
        if (! Storage::disk($this->storageDisk)->exists($model->path)) {
            throw new RuntimeException('File not found in storage.');
        }

        $encryptedContent = Storage::disk($this->storageDisk)->get($model->path);

        // Decrypt
        $decryptedContent = $this->encryptionService->decrypt($encryptedContent, $model->encryption_iv);

        // Verify Integrity
        $currentChecksum = hash('sha256', $decryptedContent);
        if ($currentChecksum !== $model->hash) {
            throw new RuntimeException('Integridad del archivo comprometida.');
        }

        return $decryptedContent;
    }

    /**
     * Soft delete a file.
     */
    public function delete(Multimedia|File $model): void
    {
        $model->delete();
    }

    protected function readFileContent(UploadedFile $file): string
    {
        return file_get_contents($file->getRealPath() ?: $file->getPathname());
    }
}
