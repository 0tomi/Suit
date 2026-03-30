<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Config;

class AiConfigService
{
    /**
     * Aplica la configuración persistida en la Base de Datos (provider, modelo, API key)
     * a la configuración de Laravel en runtime, para que el agente la utilice.
     *
     * @return array{provider: string, model: string}
     */
    public function applyConfigToRuntime(): array
    {
        $provider = Setting::getAiActiveProvider() ?: 'gemini';
        $model = Setting::getAiActiveModel() ?: 'gemini-2.0-flash';
        $apiKey = Setting::getAiApiKey($provider);

        // Inyectar la API key desencriptada a la configuración de Laravel (solo en memoria)
        if ($apiKey) {
            Config::set("ai.providers.{$provider}.key", $apiKey);
        }

        return [
            'provider' => $provider,
            'model' => $model,
        ];
    }
}
