<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSettingRequest;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /**
     * Lista todas las configuraciones del sistema.
     * Solo accessible por administradores.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Setting::class);

        $settings = Setting::query()->orderBy('key')->get(['key', 'value', 'description']);

        return response()->json($settings);
    }

    /**
     * Actualiza el valor de una configuración existente por su clave.
     * Solo accessible por administradores.
     */
    public function update(UpdateSettingRequest $request, string $key): JsonResponse
    {
        $this->authorize('update', Setting::class);

        $setting = Setting::query()->where('key', $key)->firstOrFail();

        $setting->update(['value' => $request->validated()['value']]);

        return response()->json(['key' => $setting->key, 'value' => $setting->value]);
    }
}
