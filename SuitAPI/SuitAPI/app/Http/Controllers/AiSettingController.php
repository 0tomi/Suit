<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateAiSettingRequest;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class AiSettingController extends Controller
{
    /**
     * Devuelve la configuración actual de la IA y el estado de las API keys.
     */
    public function show(): JsonResponse
    {
        if (! auth()->user()?->isAdmin()) {
            abort(403, 'Unauthorized.');
        }

        return response()->json([
            'active_provider' => Setting::getAiActiveProvider(),
            'active_model' => Setting::getAiActiveModel(),
            'has_openai_key' => Setting::getAiApiKey('openai') !== null,
            'has_gemini_key' => Setting::getAiApiKey('gemini') !== null,
            'has_anthropic_key' => Setting::getAiApiKey('anthropic') !== null,
            'has_deepseek_key' => Setting::getAiApiKey('deepseek') !== null,
        ]);
    }

    /**
     * Actualiza la configuración de proveedor activo, modelo o las API keys según corresponda.
     */
    public function update(UpdateAiSettingRequest $request): JsonResponse
    {
        $validated = $request->validated();

        if (array_key_exists('active_provider', $validated) && $validated['active_provider']) {
            Setting::setAiActiveConfig(
                $validated['active_provider'],
                $validated['active_model'] ?? null
            );
        } elseif (array_key_exists('active_model', $validated) && $validated['active_model']) {
            // Update only model if provider is already active and not passed
            Setting::setAiActiveConfig(
                Setting::getAiActiveProvider(),
                $validated['active_model']
            );
        }

        $providers = ['openai', 'gemini', 'anthropic', 'deepseek'];
        foreach ($providers as $provider) {
            $keyField = "{$provider}_key";
            if ($request->has($keyField) && ! empty($validated[$keyField])) {
                Setting::setAiApiKey($provider, $validated[$keyField]);
            }
        }

        return response()->json([
            'message' => 'Configuración de IA actualizada exitosamente.',
        ]);
    }
}
