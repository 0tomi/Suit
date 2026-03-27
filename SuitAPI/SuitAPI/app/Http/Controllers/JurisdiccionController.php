<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreJurisdiccionRequest;
use App\Http\Requests\UpdateJurisdiccionRequest;
use App\Http\Resources\CompetenciaResource;
use App\Http\Resources\JurisdiccionResource;
use App\Models\Jurisdiccion;
use App\Services\BitacoraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class JurisdiccionController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function index()
    {
        Gate::authorize('viewAny', Jurisdiccion::class);

        return JurisdiccionResource::collection(Jurisdiccion::all());
    }

    public function store(StoreJurisdiccionRequest $request)
    {
        Gate::authorize('create', Jurisdiccion::class);
        $jurisdiccion = Jurisdiccion::create($request->validated());

        $this->bitacora->record('created', $jurisdiccion);

        return new JurisdiccionResource($jurisdiccion);
    }

    public function show(Jurisdiccion $jurisdiccion)
    {
        Gate::authorize('view', $jurisdiccion);

        return new JurisdiccionResource($jurisdiccion);
    }

    public function update(UpdateJurisdiccionRequest $request, Jurisdiccion $jurisdiccion)
    {
        Gate::authorize('update', $jurisdiccion);
        $jurisdiccion->update($request->validated());

        $this->bitacora->record('updated', $jurisdiccion);

        return new JurisdiccionResource($jurisdiccion);
    }

    public function destroy(Jurisdiccion $jurisdiccion): JsonResponse
    {
        Gate::authorize('delete', $jurisdiccion);
        $jurisdiccion->delete();

        $this->bitacora->record('deleted', $jurisdiccion);

        return response()->json(null, 204);
    }

    public function lastModified()
    {
        $lastModified = Jurisdiccion::withTrashed()->max('updated_at');

        return response()->json(['last_modified' => $lastModified]);
    }

    public function syncDown(Request $request)
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);

        return JurisdiccionResource::collection(
            Jurisdiccion::withTrashed()->where('updated_at', '>=', $since)->get()
        );
    }

    public function getCompetencias(Jurisdiccion $jurisdiccion)
    {
        Gate::authorize('view', $jurisdiccion);

        return CompetenciaResource::collection($jurisdiccion->competencias);
    }
}
