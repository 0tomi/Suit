<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEntregaRequest;
use App\Http\Requests\UpdateEntregaRequest;
use App\Http\Resources\EntregaResource;
use App\Models\Entrega;
use App\Models\Honorario;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class EntregaController extends Controller
{
    public function indexByHonorario(Honorario $honorario)
    {
        Gate::authorize('view', $honorario);

        $entregas = $honorario->entregas()->with('tipoPago')->get();

        return EntregaResource::collection($entregas);
    }

    public function store(StoreEntregaRequest $request, Honorario $honorario)
    {
        Gate::authorize('update', $honorario);

        $entrega = $honorario->entregas()->create($request->validated());
        $entrega->load('tipoPago');

        $honorario->recalcularPagado();

        return new EntregaResource($entrega);
    }

    public function show(Entrega $entrega)
    {
        Gate::authorize('view', $entrega);
        $entrega->load('tipoPago');

        return new EntregaResource($entrega);
    }

    public function update(UpdateEntregaRequest $request, Entrega $entrega)
    {
        $entrega->update($request->validated());
        $entrega->load('tipoPago');

        $entrega->honorario->recalcularPagado();

        return new EntregaResource($entrega);
    }

    public function destroy(Entrega $entrega): JsonResponse
    {
        Gate::authorize('delete', $entrega);

        $honorario = $entrega->honorario;
        $entrega->delete();
        $honorario->recalcularPagado();

        return response()->json(null, 204);
    }
}
