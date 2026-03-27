<?php

namespace App\Http\Controllers;

use App\Http\Requests\RequisitoRequest;
use App\Http\Resources\RequisitoResource;
use App\Models\PlantillaRequisito;
use App\Models\Requisito;
use App\Models\Tombstone;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class RequisitoController extends Controller
{
    public function index()
    {
        return RequisitoResource::collection(Requisito::all());
    }

    public function store(RequisitoRequest $request)
    {
        $requisito = Requisito::create($request->validated());

        return new RequisitoResource($requisito);
    }

    public function show(Requisito $requisito)
    {
        return new RequisitoResource($requisito);
    }

    public function update(RequisitoRequest $request, Requisito $requisito)
    {
        $requisito->update($request->validated());

        return new RequisitoResource($requisito);
    }

    public function destroy(Requisito $requisito)
    {
        $requisito->delete();
        Tombstone::record(Tombstone::TYPE_REQUISITO, $requisito->id);

        return response()->noContent();
    }

    public function lastModified()
    {
        $lastModified = Requisito::withTrashed()->max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    public function syncDown(Request $request)
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);

        $requisitos = Requisito::where('updated_at', '>=', $since)->get();
        $deletedIds = Tombstone::deletedSince(Tombstone::TYPE_REQUISITO, $since);

        return RequisitoResource::collection($requisitos)->additional([
            'deleted_ids' => $deletedIds,
        ]);
    }

    public function templateRequirementsLastModified(int $templateId)
    {
        $lastModified = PlantillaRequisito::where('template_id', $templateId)
            ->withTrashed()
            ->max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }
}
