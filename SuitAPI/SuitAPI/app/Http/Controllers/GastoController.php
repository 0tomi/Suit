<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGastoRequest;
use App\Http\Requests\UpdateGastoRequest;
use App\Http\Resources\GastoResource;
use App\Models\Gasto;
use App\Services\BitacoraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class GastoController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function index()
    {
        Gate::authorize('viewAny', Gasto::class);

        return GastoResource::collection(Gasto::all());
    }

    public function store(StoreGastoRequest $request)
    {
        $gasto = Gasto::create($request->validated());

        $this->bitacora->record('created', $gasto);

        return new GastoResource($gasto);
    }

    public function show(Gasto $gasto)
    {
        Gate::authorize('view', $gasto);

        return new GastoResource($gasto);
    }

    public function update(UpdateGastoRequest $request, Gasto $gasto)
    {
        $gasto->update($request->validated());

        $this->bitacora->record('updated', $gasto);

        return new GastoResource($gasto);
    }

    public function destroy(Gasto $gasto): JsonResponse
    {
        Gate::authorize('delete', $gasto);

        $gasto->delete();

        $this->bitacora->record('deleted', $gasto);

        return response()->json(null, 204);
    }
}
