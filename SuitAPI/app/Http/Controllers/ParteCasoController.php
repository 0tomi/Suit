<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreParteCasoRequest;
use App\Http\Resources\ParteResource;
use App\Models\Parte;
use App\Models\SuitCase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ParteCasoController extends Controller
{
    public function index(SuitCase $suitCase): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('view', $suitCase);

        return ParteResource::collection($suitCase->partes()->with('rol')->get());
    }

    public function store(StoreParteCasoRequest $request, SuitCase $suitCase): ParteResource
    {
        $suitCase->partes()->syncWithoutDetaching([$request->parte_id]);

        $parte = Parte::with('rol')->findOrFail($request->parte_id);

        return new ParteResource($parte);
    }

    public function destroy(SuitCase $suitCase, Parte $parte): JsonResponse
    {
        Gate::authorize('update', $suitCase);

        $suitCase->partes()->detach($parte->id);

        return response()->json(null, 204);
    }
}
