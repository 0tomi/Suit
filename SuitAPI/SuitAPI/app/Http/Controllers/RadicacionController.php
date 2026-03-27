<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRadicacionRequest;
use App\Http\Requests\UpdateRadicacionRequest;
use App\Http\Resources\RadicacionResource;
use App\Models\Radicacion;
use App\Services\BitacoraService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class RadicacionController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function index()
    {
        Gate::authorize('viewAny', Radicacion::class);

        return RadicacionResource::collection(Radicacion::all());
    }

    public function store(StoreRadicacionRequest $request)
    {
        $radicacion = Radicacion::create($request->validated());

        $this->bitacora->record('created', $radicacion);

        return new RadicacionResource($radicacion);
    }

    public function update(UpdateRadicacionRequest $request, Radicacion $radicacion)
    {
        Gate::authorize('update', $radicacion);
        $radicacion->update($request->validated());

        $this->bitacora->record('updated', $radicacion);

        return new RadicacionResource($radicacion);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Radicacion $radicacion)
    {
        Gate::authorize('delete', $radicacion);
        $radicacion->delete();

        $this->bitacora->record('deleted', $radicacion);

        return response()->noContent();
    }

    public function lastModified()
    {
        $lastModified = Radicacion::withTrashed()->max('updated_at');

        return response()->json(['last_modified' => $lastModified]);
    }

    public function syncDown(Request $request)
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);

        return RadicacionResource::collection(
            Radicacion::withTrashed()->where('updated_at', '>=', $since)->get()
        );
    }
}
