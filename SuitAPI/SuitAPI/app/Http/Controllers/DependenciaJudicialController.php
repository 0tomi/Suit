<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDependenciaJudicialRequest;
use App\Http\Requests\UpdateDependenciaJudicialRequest;
use App\Http\Resources\DependenciaJudicialResource;
use App\Models\DependenciaJudicial;
use App\Services\BitacoraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class DependenciaJudicialController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function index()
    {
        Gate::authorize('viewAny', DependenciaJudicial::class);

        return DependenciaJudicialResource::collection(DependenciaJudicial::with(['jurisdiccion', 'competencia', 'radicacion'])->get());
    }

    public function store(StoreDependenciaJudicialRequest $request)
    {
        Gate::authorize('create', DependenciaJudicial::class);
        $dependenciaJudicial = DependenciaJudicial::create($request->validated());

        $this->bitacora->record('created', $dependenciaJudicial);

        return new DependenciaJudicialResource($dependenciaJudicial->load(['jurisdiccion', 'competencia', 'radicacion']));
    }

    public function show(DependenciaJudicial $dependenciaJudicial)
    {
        Gate::authorize('view', $dependenciaJudicial);

        return new DependenciaJudicialResource($dependenciaJudicial->load(['jurisdiccion', 'competencia', 'radicacion']));
    }

    public function update(UpdateDependenciaJudicialRequest $request, DependenciaJudicial $dependenciaJudicial)
    {
        Gate::authorize('update', $dependenciaJudicial);
        $dependenciaJudicial->update($request->validated());

        $this->bitacora->record('updated', $dependenciaJudicial);

        return new DependenciaJudicialResource($dependenciaJudicial->load(['jurisdiccion', 'competencia', 'radicacion']));
    }

    public function destroy(DependenciaJudicial $dependenciaJudicial): JsonResponse
    {
        Gate::authorize('delete', $dependenciaJudicial);
        $dependenciaJudicial->delete();

        $this->bitacora->record('deleted', $dependenciaJudicial);

        return response()->json(null, 204);
    }

    public function lastModified()
    {
        $lastModified = DependenciaJudicial::withTrashed()->max('updated_at');

        return response()->json(['last_modified' => $lastModified]);
    }

    public function syncDown(Request $request)
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);

        return DependenciaJudicialResource::collection(
            DependenciaJudicial::withTrashed()->with(['jurisdiccion', 'competencia', 'radicacion'])
                ->where('updated_at', '>=', $since)->get()
        );
    }
}
