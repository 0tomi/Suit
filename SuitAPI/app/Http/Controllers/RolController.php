<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRolRequest;
use App\Http\Requests\UpdateRolRequest;
use App\Http\Resources\RolResource;
use App\Models\Rol;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class RolController extends Controller
{
    public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Rol::class);

        return RolResource::collection(Rol::all());
    }

    public function store(StoreRolRequest $request): RolResource
    {
        $rol = Rol::create($request->validated());

        return new RolResource($rol);
    }

    public function show(Rol $rol): RolResource
    {
        Gate::authorize('view', $rol);

        return new RolResource($rol);
    }

    public function update(UpdateRolRequest $request, Rol $rol): RolResource
    {
        $rol->update($request->validated());

        return new RolResource($rol);
    }

    public function destroy(Rol $rol): JsonResponse
    {
        Gate::authorize('delete', $rol);

        $rol->delete();

        return response()->json(null, 204);
    }
}
