<?php

namespace App\Services;

use Illuminate\Support\Str;
use RuntimeException;

class FileEncryptionService
{
    /**
     * Encrypt content using AES-256-CBC.
     * Returns an array with ['content' => string, 'iv' => string]
     */
    public function encrypt(string $content): array
    {
        $key = $this->getEncryptionKey();

        // Generate IV
        $ivLen = openssl_cipher_iv_length('aes-256-cbc');
        $iv = openssl_random_pseudo_bytes($ivLen);

        // Encrypt with explicit IV and Raw Data output (binary)
        $encryptedContent = openssl_encrypt($content, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);

        if ($encryptedContent === false) {
            throw new RuntimeException('Encryption failed.');
        }

        return [
            'content' => $encryptedContent,
            'iv' => base64_encode($iv),
        ];
    }

    /**
     * Decrypt content using AES-256-CBC.
     */
    public function decrypt(string $encryptedContent, string $ivBase64): string
    {
        $key = $this->getEncryptionKey();
        $iv = base64_decode($ivBase64);

        $decryptedContent = openssl_decrypt($encryptedContent, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);

        if ($decryptedContent === false) {
            throw new RuntimeException('Decryption failed.');
        }

        return $decryptedContent;
    }

    protected function getEncryptionKey(): string
    {
        $key = config('app.key');

        if (Str::startsWith($key, 'base64:')) {
            $key = base64_decode(substr($key, 7));
        }

        return $key;
    }
}
