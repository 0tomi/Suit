<?php

namespace App\Http\Controllers;

use App\Http\Requests\HonorariosByDateRangeRequest;
use App\Http\Requests\StoreHonorarioRequest;
use App\Http\Requests\UpdateHonorarioRequest;
use App\Http\Resources\HonorarioResource;
use App\Models\Client;
use App\Models\Honorario;
use App\Models\SuitCase;
use App\Services\BitacoraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class HonorarioController extends Controller
{
    public function __construct(protected BitacoraService $bitacora) {}

    public function byDateRange(HonorariosByDateRangeRequest $request)
    {
        Gate::authorize('viewAny', Honorario::class);

        $honorarios = Honorario::getByDateRange(
            auth()->user(),
            $request->from,
            $request->to,
            $request->query('user_id')
        );

        return HonorarioResource::collection($honorarios);
    }

    public function indexByCase(Request $request, SuitCase $suitCase)
    {
        Gate::authorize('viewAny', Honorario::class);

        $honorarios = $suitCase->honorarios()
            ->with(['client', 'entregas'])
            ->when($request->query('user_id'), function ($query, $userId) {
                $query->where('user_id', $userId);
            })
            ->when(auth()->user()->role !== 'admin', function ($query) {
                $query->where('user_id', auth()->id());
            })
            ->get();

        return HonorarioResource::collection($honorarios);
    }

    public function indexByClient(Request $request, Client $client)
    {
        Gate::authorize('viewAny', Honorario::class);

        $honorarios = $client->honorarios()
            ->with(['suitCase', 'entregas'])
            ->when($request->query('user_id'), function ($query, $userId) {
                $query->where('user_id', $userId);
            })
            ->when(auth()->user()->role !== 'admin', function ($query) {
                $query->where('user_id', auth()->id());
            })
            ->get();

        return HonorarioResource::collection($honorarios);
    }

    public function store(StoreHonorarioRequest $request, SuitCase $suitCase)
    {
        Gate::authorize('case-write', $suitCase);

        $data = $request->validated();
        $data['user_id'] = auth()->id();
        $data['suit_case_id'] = $suitCase->id;

        $caseClientsIds = $suitCase->clients()->pluck('clients.id')->toArray();
        if (! in_array($data['client_id'], $caseClientsIds)) {
            abort(422, 'El cliente especificado no pertenece a este caso.');
        }

        $honorario = Honorario::create($data);
        $honorario->load(['client', 'entregas']);

        $this->bitacora->record('created', $honorario);

        return new HonorarioResource($honorario);
    }

    public function show(Honorario $honorario)
    {
        Gate::authorize('view', $honorario);

        $honorario->load(['client', 'entregas', 'suitCase']);

        return new HonorarioResource($honorario);
    }

    public function update(UpdateHonorarioRequest $request, Honorario $honorario)
    {
        Gate::authorize('update', $honorario);

        $honorario->update($request->validated());
        $honorario->load(['client', 'entregas']);

        $this->bitacora->record('updated', $honorario);

        return new HonorarioResource($honorario);
    }

    public function destroy(Honorario $honorario): JsonResponse
    {
        Gate::authorize('delete', $honorario);

        $honorario->delete();

        $this->bitacora->record('deleted', $honorario);

        return response()->json(null, 204);
    }
}
