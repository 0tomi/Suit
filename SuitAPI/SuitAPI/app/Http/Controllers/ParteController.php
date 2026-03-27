<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreParteRequest;
use App\Http\Requests\UpdateParteRequest;
use App\Http\Resources\ParteResource;
use App\Models\Parte;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class ParteController extends Controller
{
    /**
     * Return all partes (including soft-deleted) modified after the given `since` timestamp.
     * Used by the offline client to fetch only the delta and detect remotely-deleted records.
     */
    public function syncDown(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);

        $partes = Parte::withTrashed()->where('updated_at', '>=', $since)->get();

        return ParteResource::collection($partes);
    }

    public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Parte::class);

        return ParteResource::collection(Parte::with('rol')->get());
    }

    public function store(StoreParteRequest $request): ParteResource
    {
        $parte = Parte::create($request->validated());
        $parte->load('rol');

        return new ParteResource($parte);
    }

    public function show(Parte $parte): ParteResource
    {
        Gate::authorize('view', $parte);

        $parte->load('rol');

        return new ParteResource($parte);
    }

    public function update(UpdateParteRequest $request, Parte $parte): ParteResource
    {
        $parte->update($request->validated());
        $parte->load('rol');

        return new ParteResource($parte);
    }

    public function destroy(Parte $parte): JsonResponse
    {
        Gate::authorize('delete', $parte);

        $parte->delete();

        return response()->json(null, 204);
    }
}
