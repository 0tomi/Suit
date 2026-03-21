<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTipoExpedienteRequest;
use App\Http\Requests\UpdateTipoExpedienteRequest;
use App\Http\Resources\TipoExpedienteResource;
use App\Models\TipoExpediente;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class TipoExpedienteController extends Controller
{
    public function index()
    {
        Gate::authorize('viewAny', TipoExpediente::class);

        return TipoExpedienteResource::collection(TipoExpediente::all());
    }

    public function store(StoreTipoExpedienteRequest $request)
    {
        $tipoExpediente = TipoExpediente::create($request->validated());

        return new TipoExpedienteResource($tipoExpediente);
    }

    public function show(TipoExpediente $tipoExpediente)
    {
        Gate::authorize('view', $tipoExpediente);

        return new TipoExpedienteResource($tipoExpediente);
    }

    public function update(UpdateTipoExpedienteRequest $request, TipoExpediente $tipoExpediente)
    {
        $tipoExpediente->update($request->validated());

        return new TipoExpedienteResource($tipoExpediente);
    }

    public function destroy(TipoExpediente $tipoExpediente): JsonResponse
    {
        Gate::authorize('delete', $tipoExpediente);

        $tipoExpediente->delete();

        return response()->json(null, 204);
    }
}
