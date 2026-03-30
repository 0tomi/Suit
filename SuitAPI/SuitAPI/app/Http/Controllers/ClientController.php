<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Http\Requests\StoreClientRequest;
use App\Http\Requests\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Http\Resources\DocumentResource;
use App\Models\Client;
use App\Models\Document;
use App\Models\Persona;
use App\Models\SuitCase;
use App\Services\BitacoraService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

class ClientController extends Controller
{
    use ChecksForConflict;

    public function __construct(protected BitacoraService $bitacora) {}

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Client::with('persona');

        if ($search = $request->input('search')) {
            $query->whereHas('persona', function (Builder $query) use ($search) {
                $query->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('identification_number', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        if ($status = $request->input('status')) {
            $query->whereHas('persona', function ($q) use ($status) {
                $q->where('status', $status);
            });
        }

        if ($financialStatus = $request->input('financial_status')) {
            $query->where('financial_status', $financialStatus);
        }

        return ClientResource::collection($query->paginate(30));
    }

    /**
     * Return all clients (including soft-deleted) modified after the given `since` timestamp.
     * Used by the offline client to fetch only the delta and detect remotely-deleted records.
     */
    public function syncDown(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);

        $clients = Client::withTrashed()->with('persona')->where('updated_at', '>=', $since)->get();

        return ClientResource::collection($clients);
    }

    /**
     * Receive multiple clients from client offline database to update/create them.
     */
    public function syncUp(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'clients' => 'required|array',
            'clients.*.first_name' => 'required|string',
            'clients.*.last_name' => 'required|string',
            'clients.*.gender' => 'required|in:M,F,X',
        ]);

        $synced = [];
        $conflicts = [];

        $personaFields = ['first_name', 'last_name', 'identification_number', 'email', 'phone', 'address', 'gender', 'status', 'notes'];

        foreach ($request->clients as $clientData) {
            try {
                $personaData = Arr::only($clientData, $personaFields);
                $clientOnlyData = Arr::except($clientData, $personaFields);

                if (isset($clientData['id']) && $clientData['id']) {
                    // It's an update
                    $client = Client::find($clientData['id']);

                    if ($client) {
                        try {
                            $this->checkForConflict($client, $clientOnlyData);
                            if ($client->persona) {
                                $client->persona->update($personaData);
                            } else {
                                $persona = Persona::create($personaData);
                                $clientOnlyData['persona_id'] = $persona->id;
                            }
                            $client->update($clientOnlyData);
                            $this->bitacora->record('updated', $client);
                            $synced[] = clone $client->load('persona');
                        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                            if ($e->getStatusCode() === 409) {
                                $conflicts[] = $clientData['id'];
                            } else {
                                throw $e;
                            }
                        }
                    }
                } else {
                    // It's a creation
                    $persona = Persona::create($personaData);
                    $clientOnlyData['persona_id'] = $persona->id;
                    $client = Client::create($clientOnlyData);

                    $this->bitacora->record('created', $client);
                    $synced[] = clone $client->load('persona');
                }
            } catch (\Exception $e) {
                // If a single record fails for another reason (e.g validation uniquely), skip it
                // Alternatively, we could log it.
                continue;
            }
        }

        return response()->json([
            'synced' => ClientResource::collection($synced),
            'conflicts' => $conflicts,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreClientRequest $request)
    {
        $data = $request->validated();

        $personaFields = ['first_name', 'last_name', 'identification_number', 'email', 'phone', 'address', 'gender', 'status', 'notes'];
        $personaData = Arr::only($data, $personaFields);
        $clientData = Arr::except($data, $personaFields);

        $persona = Persona::create($personaData);
        $clientData['persona_id'] = $persona->id;

        $client = Client::create($clientData);
        $client->setRelation('persona', $persona);

        $this->bitacora->record('created', $client);

        return new ClientResource($client);
    }

    /**
     * Display the specified resource.
     */
    public function show(Client $client)
    {
        $client->load(['cases', 'documents', 'persona']);

        return new ClientResource($client);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateClientRequest $request, Client $client)
    {
        $this->checkForConflict($client, $request);

        $data = $request->validated();

        $personaFields = ['first_name', 'last_name', 'identification_number', 'email', 'phone', 'address', 'gender', 'status', 'notes'];
        $personaData = Arr::only($data, $personaFields);
        $clientData = Arr::except($data, $personaFields);

        if ($client->persona) {
            $client->persona->update($personaData);
        } else {
            $persona = Persona::create($personaData);
            $clientData['persona_id'] = $persona->id;
        }

        $client->update($clientData);
        $client->load('persona');

        $this->bitacora->record('updated', $client);

        return new ClientResource($client);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Client $client)
    {
        $client->delete();

        $this->bitacora->record('deleted', $client);

        return response()->noContent();
    }

    public function getForCase(SuitCase $case)
    {
        $this->authorize('view', $case);

        return ClientResource::collection($case->clients()->with('persona')->get());
    }

    public function attachCase(Request $request, SuitCase $case)
    {
        $this->authorize('update', $case);

        $request->validate([
            'client_ids' => ['required', 'array'],
            'client_ids.*' => ['exists:clients,id'],
        ]);

        $case->clients()->syncWithoutDetaching($request->client_ids);
        $case->touch();

        // Recalcular estado de los clientes afectados
        $clients = Client::whereIn('id', $request->client_ids)->get();
        foreach ($clients as $client) {
            $client->recalculateStatus();
        }

        return response()->json(['message' => 'Clients attached to case successfully']);
    }

    public function detachCase(SuitCase $case, Client $client)
    {
        $this->authorize('update', $case);

        $case->clients()->detach($client->id);
        $case->touch();

        // Recalcular estado del cliente
        $client->recalculateStatus();

        return response()->json(['message' => 'Client detached from case successfully']);
    }

    public function attachDocument(Request $request, Document $document)
    {
        $this->authorize('update', $document);

        $request->validate([
            'client_ids' => ['required', 'array'],
            'client_ids.*' => ['exists:clients,id'],
        ]);

        $document->clients()->syncWithoutDetaching($request->input('client_ids'));
        $document->touch();

        return response()->json(['message' => 'Clients attached to document successfully']);
    }

    public function getClients(Document $document)
    {
        $this->authorize('view', $document);

        return ClientResource::collection($document->clients()->with('persona')->get());
    }

    public function detachDocument(Document $document, Client $client)
    {
        $this->authorize('update', $document);

        $document->clients()->detach($client->id);
        $document->touch();

        return response()->json(['message' => 'Client detached from document successfully']);
    }

    public function getDocuments(Request $request, Client $client)
    {
        $user = $request->user();

        // 1. Documentos Personales: Directamente asociados al cliente que no tienen suit_case_id.
        // El scope accessibleBy ya maneja que el Admin vea todos y el Abogado solo los suyos.
        $personalDocs = $client->documents()
            ->whereNull('documents.suit_case_id')
            ->accessibleBy($user)
            ->latest()
            ->paginate(15, ['*'], 'page_personal');

        // 2. Casos del Cliente: Casos accesibles por el usuario donde participa el cliente.
        $cases = $client->cases()
            ->accessibleBy($user)
            ->with(['dependenciaJudicial.competencia'])
            ->latest()
            ->paginate(5, ['*'], 'page_cases');

        // 3. Transformación de los casos para incluir sus documentos (también paginados).
        // El parámetro page_case_docs afectará a todos los bloques de documentos de los casos listados.
        $casesData = $cases->getCollection()->map(function (SuitCase $case) use ($user) {
            $caseDocs = $case->documents()
                ->accessibleBy($user)
                ->latest()
                ->paginate(5, ['*'], 'page_case_docs');

            return [
                'id' => $case->id,
                'nombre' => $case->title,
                'estado' => $case->status,
                'fuero' => $case->dependenciaJudicial?->competencia?->fuero ?? 'N/A',
                'documentos' => DocumentResource::collection($caseDocs)->response()->getData(true),
            ];
        });

        return response()->json([
            'personales' => DocumentResource::collection($personalDocs)->response()->getData(true),
            'por_casos' => [
                'data' => $casesData,
                'links' => $cases->linkCollection(),
                'meta' => [
                    'current_page' => $cases->currentPage(),
                    'from' => $cases->firstItem(),
                    'last_page' => $cases->lastPage(),
                    'path' => $cases->path(),
                    'per_page' => $cases->perPage(),
                    'to' => $cases->lastItem(),
                    'total' => $cases->total(),
                ],
            ],
        ]);
    }
}
