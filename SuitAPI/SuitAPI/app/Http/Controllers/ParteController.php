<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreParteRequest;
use App\Http\Requests\UpdateParteRequest;
use App\Http\Resources\ParteResource;
use App\Models\Parte;
use App\Models\Persona;
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

        $partes = Parte::withTrashed()->with(['rol', 'persona'])->where('updated_at', '>=', $since)->get();

        return ParteResource::collection($partes);
    }

    public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Parte::class);

        return ParteResource::collection(Parte::with(['rol', 'persona'])->get());
    }

    public function store(StoreParteRequest $request): ParteResource
    {
        $data = $request->validated();

        $personaData = [
            'first_name' => $data['nombre'] ?? null,
            'last_name' => $data['apellido'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['telefono'] ?? null,
            'identification_number' => $data['identificacion'] ?? null,
            'address' => $data['direccion'] ?? null,
            'gender' => $data['genero'] ?? null,
            'status' => $data['estado'] ?? Persona::STATUS_ACTIVO,
            'notes' => $data['notas'] ?? null,
        ];

        $persona = Persona::create($personaData);

        $parte = Parte::create([
            'rol_id' => $data['rol_id'] ?? null,
            'persona_id' => $persona->id,
        ]);

        $parte->setRelation('persona', $persona);
        $parte->load('rol');

        return new ParteResource($parte);
    }

    public function show(Parte $parte): ParteResource
    {
        Gate::authorize('view', $parte);

        $parte->load(['rol', 'persona']);

        return new ParteResource($parte);
    }

    public function update(UpdateParteRequest $request, Parte $parte): ParteResource
    {
        $data = $request->validated();

        $personaData = [
            'first_name' => $data['nombre'] ?? null,
            'last_name' => $data['apellido'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['telefono'] ?? null,
            'identification_number' => $data['identificacion'] ?? null,
            'address' => $data['direccion'] ?? null,
            'gender' => $data['genero'] ?? null,
            'status' => $data['estado'] ?? null,
            'notes' => $data['notas'] ?? null,
        ];

        if ($parte->persona) {
            $parte->persona->update(array_filter($personaData, fn ($val) => ! is_null($val)));
        } else {
            $persona = Persona::create($personaData);
            $parte->update(['persona_id' => $persona->id]);
        }

        if (array_key_exists('rol_id', $data)) {
            $parte->update(['rol_id' => $data['rol_id']]);
        }

        $parte->load(['rol', 'persona']);

        return new ParteResource($parte);
    }

    public function destroy(Parte $parte): JsonResponse
    {
        Gate::authorize('delete', $parte);

        $parte->delete();

        return response()->json(null, 204);
    }
}
