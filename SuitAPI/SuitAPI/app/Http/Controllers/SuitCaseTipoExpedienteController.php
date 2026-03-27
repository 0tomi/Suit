<?php

namespace App\Http\Controllers;

use App\Models\SuitCase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SuitCaseTipoExpedienteController extends Controller
{
    public function index(SuitCase $suitCase): JsonResponse
    {
        Gate::authorize('view', $suitCase);

        return response()->json($suitCase->tipoExpedientes()->get());
    }

    public function sync(Request $request, SuitCase $suitCase): JsonResponse
    {
        Gate::authorize('update', $suitCase);

        $validated = $request->validate([
            'tipo_expediente_ids' => ['required', 'array'],
            'tipo_expediente_ids.*' => ['exists:tipo_expedientes,id'],
        ]);

        $suitCase->tipoExpedientes()->sync($validated['tipo_expediente_ids']);

        return response()->json([
            'message' => 'Tipos de expedientes sincronizados correctamente',
            'tipo_expedientes' => $suitCase->tipoExpedientes()->get(),
        ]);
    }
}
