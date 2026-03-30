<?php

namespace App\Http\Controllers;

use App\Http\Requests\GastosByDateRangeRequest;
use App\Http\Requests\StoreGastoSuitCaseRequest;
use App\Http\Requests\UpdateGastoSuitCaseRequest;
use App\Http\Resources\GastoSuitCaseResource;
use App\Models\GastoSuitCase;
use App\Models\SuitCase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class GastoSuitCaseController extends Controller
{
    public function stats(GastosByDateRangeRequest $request)
    {
        Gate::authorize('viewAny', GastoSuitCase::class);

        $query = GastoSuitCase::getByDateRange(
            auth()->user(),
            $request->from,
            $request->to,
            $request->query('user_id')
        );

        $gastos = $query->get();

        $stats = $gastos->groupBy(function ($item) {
            return $item->created_at->format('Y-m');
        })->map(function ($monthGroup, $month) {
            return [
                'month' => $month,
                'count' => $monthGroup->count(),
                'total_amount' => round($monthGroup->sum('monto'), 2),
            ];
        })->values()->sortBy('month')->values();

        return response()->json($stats);
    }

    public function byDateRange(GastosByDateRangeRequest $request)
    {
        Gate::authorize('viewAny', GastoSuitCase::class);

        $query = GastoSuitCase::getByDateRange(
            auth()->user(),
            $request->from,
            $request->to,
            $request->query('user_id')
        );

        return GastoSuitCaseResource::collection($query->paginate(30));
    }

    public function indexByCase(SuitCase $suitCase)
    {
        Gate::authorize('viewAny', GastoSuitCase::class);

        $gastos = $suitCase->gastos()
            ->with(['type', 'clients'])
            ->when(auth()->user()->role !== 'admin', function ($query) {
                $query->where('user_id', auth()->id());
            })
            ->get();

        return GastoSuitCaseResource::collection($gastos);
    }

    public function store(StoreGastoSuitCaseRequest $request, SuitCase $suitCase)
    {
        Gate::authorize('case-write', $suitCase);

        $data = $request->validated();
        $data['user_id'] = auth()->id();
        $data['suit_case_id'] = $suitCase->id;

        $caseClientsIds = $suitCase->clients()->pluck('clients.id')->toArray();

        // Attach clients
        $clientIds = [];
        if (! empty($data['client_ids'])) {
            $clientIds = $data['client_ids'];
        } elseif (! empty($data['client_id'])) {
            $clientIds = [$data['client_id']];
        } else {
            // Automatically assign the only client if there's only one
            if (count($caseClientsIds) === 1) {
                $clientIds = [$caseClientsIds[0]];
            } else {
                abort(422, 'El caso tiene múltiples clientes. Debe especificar a quién/quiénes se asigna este gasto.');
            }
        }

        foreach ($clientIds as $cId) {
            if (! in_array($cId, $caseClientsIds)) {
                abort(422, 'Uno o más clientes especificados no pertenecen a este caso.');
            }
        }

        $gastoSuitCase = GastoSuitCase::create($data);

        if (! empty($clientIds)) {
            $gastoSuitCase->clients()->attach($clientIds);
        }

        $gastoSuitCase->load(['type', 'clients']);

        return new GastoSuitCaseResource($gastoSuitCase);
    }

    public function show(GastoSuitCase $gastoSuitCase)
    {
        Gate::authorize('view', $gastoSuitCase);

        $gastoSuitCase->load(['type', 'clients']);

        return new GastoSuitCaseResource($gastoSuitCase);
    }

    public function update(UpdateGastoSuitCaseRequest $request, GastoSuitCase $gastoSuitCase)
    {
        Gate::authorize('update', $gastoSuitCase);

        $data = $request->validated();

        $gastoSuitCase->update($data);

        if (isset($data['client_ids'])) {
            $gastoSuitCase->clients()->sync($data['client_ids']);
        }

        $gastoSuitCase->load(['type', 'clients']);

        return new GastoSuitCaseResource($gastoSuitCase);
    }

    public function destroy(GastoSuitCase $gastoSuitCase): JsonResponse
    {
        Gate::authorize('delete', $gastoSuitCase);

        $gastoSuitCase->delete();

        return response()->json(null, 204);
    }
}
