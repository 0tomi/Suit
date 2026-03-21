<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRadicacionRequest;
use App\Http\Requests\UpdateRadicacionRequest;
use App\Http\Resources\RadicacionResource;
use App\Models\Radicacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class RadicacionController extends Controller
{
    public function index()
    {
        Gate::authorize('viewAny', Radicacion::class);

        return RadicacionResource::collection(Radicacion::all());
    }

    public function store(StoreRadicacionRequest $request)
    {
        $radicacion = Radicacion::create($request->validated());

        return new RadicacionResource($radicacion);
    }

    public function show(Radicacion $radicacion)
    {
        Gate::authorize('view', $radicacion);

        return new RadicacionResource($radicacion);
    }

    public function update(UpdateRadicacionRequest $request, Radicacion $radicacion)
    {
        $radicacion->update($request->validated());

        return new RadicacionResource($radicacion);
    }

    public function destroy(Radicacion $radicacion): JsonResponse
    {
        Gate::authorize('delete', $radicacion);

        $radicacion->delete();

        return response()->json(null, 204);
    }
}
