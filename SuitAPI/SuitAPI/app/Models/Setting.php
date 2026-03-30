<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value', 'description'];

    /**
     * Obtiene el valor de una configuración por su clave.
     * Retorna $default si la clave no existe.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = static::query()->where('key', $key)->first();

        return $setting?->value ?? $default;
    }

    /**
     * Crea o actualiza una configuración por su clave.
     */
    public static function set(string $key, mixed $value): static
    {
        return static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => (string) $value]
        );
    }

    /**
     * Obtiene el proveedor de IA activo.
     */
    public static function getAiActiveProvider(): ?string
    {
        return static::get('ai_active_provider', 'gemini');
    }

    /**
     * Obtiene el modelo de IA activo.
     */
    public static function getAiActiveModel(): ?string
    {
        return static::get('ai_active_model', 'gemini-2.0-flash');
    }

    /**
     * Obtiene y desencripta la clave de un proveedor específico.
     */
    public static function getAiApiKey(string $provider): ?string
    {
        $encryptedKey = static::get("ai_{$provider}_key");

        if (! $encryptedKey) {
            return null;
        }

        try {
            return \Illuminate\Support\Facades\Crypt::decryptString($encryptedKey);
        } catch (\Illuminate\Contracts\Encryption\DecryptException $e) {
            return null;
        }
    }

    /**
     * Define el proveedor y modelo de IA activos.
     */
    public static function setAiActiveConfig(string $provider, ?string $model): void
    {
        static::set('ai_active_provider', $provider);
        if ($model) {
            static::set('ai_active_model', $model);
        }
    }

    /**
     * Encripta y guarda la API key de un proveedor.
     */
    public static function setAiApiKey(string $provider, string $apiKey): void
    {
        $encryptedKey = \Illuminate\Support\Facades\Crypt::encryptString($apiKey);
        static::set("ai_{$provider}_key", $encryptedKey);
    }
}
