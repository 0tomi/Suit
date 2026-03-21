<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTipoPagoRequest;
use App\Http\Requests\UpdateTipoPagoRequest;
use App\Http\Resources\TipoPagoResource;
use App\Models\TipoPago;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class TipoPagoController extends Controller
{
    public function index()
    {
        Gate::authorize('viewAny', TipoPago::class);

        return TipoPagoResource::collection(TipoPago::all());
    }

    public function store(StoreTipoPagoRequest $request)
    {
        $tipoPago = TipoPago::create($request->validated());

        return new TipoPagoResource($tipoPago);
    }

    public function show(TipoPago $tipoPago)
    {
        Gate::authorize('view', $tipoPago);

        return new TipoPagoResource($tipoPago);
    }

    public function update(UpdateTipoPagoRequest $request, TipoPago $tipoPago)
    {
        $tipoPago->update($request->validated());

        return new TipoPagoResource($tipoPago);
    }

    public function destroy(TipoPago $tipoPago): JsonResponse
    {
        Gate::authorize('delete', $tipoPago);

        $tipoPago->delete();

        return response()->json(null, 204);
    }
}
