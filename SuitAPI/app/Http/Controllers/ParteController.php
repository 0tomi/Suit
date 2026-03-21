<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreParteRequest;
use App\Http\Requests\UpdateParteRequest;
use App\Http\Resources\ParteResource;
use App\Models\Parte;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class ParteController extends Controller
{
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
