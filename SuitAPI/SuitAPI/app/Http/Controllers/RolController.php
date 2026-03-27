<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRolRequest;
use App\Http\Requests\UpdateRolRequest;
use App\Http\Resources\RolResource;
use App\Models\Rol;
use App\Services\BitacoraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class RolController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Rol::class);

        return RolResource::collection(Rol::all());
    }

    public function store(StoreRolRequest $request): RolResource
    {
        $rol = Rol::create($request->validated());

        $this->bitacora->record('created', $rol);

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

        $this->bitacora->record('updated', $rol);

        return new RolResource($rol);
    }

    public function destroy(Rol $rol): JsonResponse
    {
        Gate::authorize('delete', $rol);

        $rol->delete();

        $this->bitacora->record('deleted', $rol);

        return response()->json(null, 204);
    }
}
