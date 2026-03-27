<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCompetenciaRequest;
use App\Http\Requests\UpdateCompetenciaRequest;
use App\Http\Resources\CompetenciaResource;
use App\Models\Competencia;
use App\Services\BitacoraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class CompetenciaController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function index()
    {
        Gate::authorize('viewAny', Competencia::class);

        return CompetenciaResource::collection(Competencia::all());
    }

    public function store(StoreCompetenciaRequest $request)
    {
        Gate::authorize('create', Competencia::class);
        $competencia = Competencia::create($request->validated());

        $this->bitacora->record('created', $competencia);

        return new CompetenciaResource($competencia);
    }

    public function show(Competencia $competencia)
    {
        Gate::authorize('view', $competencia);

        return new CompetenciaResource($competencia);
    }

    public function update(UpdateCompetenciaRequest $request, Competencia $competencia)
    {
        Gate::authorize('update', $competencia);
        $competencia->update($request->validated());

        $this->bitacora->record('updated', $competencia);

        return new CompetenciaResource($competencia);
    }

    public function destroy(Competencia $competencia): JsonResponse
    {
        Gate::authorize('delete', $competencia);
        $competencia->delete();

        $this->bitacora->record('deleted', $competencia);

        return response()->json(null, 204);
    }

    public function lastModified()
    {
        $lastModified = Competencia::withTrashed()->max('updated_at');

        return response()->json(['last_modified' => $lastModified]);
    }

    public function syncDown(Request $request)
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);

        return CompetenciaResource::collection(
            Competencia::withTrashed()->where('updated_at', '>=', $since)->get()
        );
    }
}
