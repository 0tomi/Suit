<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Http\Requests\StoreClientRequest;
use App\Http\Requests\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Models\Document;
use App\Models\SuitCase;
use App\Services\BitacoraService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
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
        $query = Client::query();

        if ($search = $request->input('search')) {
            $query->where(function (Builder $query) use ($search) {
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
            $query->where('status', $status);
        }

        return ClientResource::collection($query->paginate(15));
    }

    /**
     * Return all clients (including soft-deleted) modified after the given `since` timestamp.
     * Used by the offline client to fetch only the delta and detect remotely-deleted records.
     */
    public function syncDown(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);

        $clients = Client::withTrashed()->where('updated_at', '>=', $since)->get();

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

        foreach ($request->clients as $clientData) {
            try {
                if (isset($clientData['id']) && $clientData['id']) {
                    // It's an update
                    $client = Client::find($clientData['id']);

                    if ($client) {
                        try {
                            $this->checkForConflict($client, $clientData);
                            $client->update($clientData);
                            $this->bitacora->record('updated', $client);
                            $synced[] = clone $client;
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
                    $client = Client::create($clientData);
                    $this->bitacora->record('created', $client);
                    $synced[] = $client;
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
        $client = Client::create($request->validated());

        $this->bitacora->record('created', $client);

        return new ClientResource($client);
    }

    /**
     * Display the specified resource.
     */
    public function show(Client $client)
    {
        $client->load(['cases', 'documents']);

        return new ClientResource($client);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateClientRequest $request, Client $client)
    {
        $this->checkForConflict($client, $request);

        $client->update($request->validated());

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

        return ClientResource::collection($case->clients);
    }

    public function attachCase(Request $request, SuitCase $case)
    {
        $this->authorize('update', $case);

        $request->validate([
            'client_ids' => ['required', 'array'],
            'client_ids.*' => ['exists:clients,id'],
        ]);

        $case->clients()->syncWithoutDetaching($request->input('client_ids'));
        $case->touch();

        return response()->json(['message' => 'Clients attached to case successfully']);
    }

    public function detachCase(SuitCase $case, Client $client)
    {
        $this->authorize('update', $case);

        $case->clients()->detach($client->id);
        $case->touch();

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

    public function detachDocument(Document $document, Client $client)
    {
        $this->authorize('update', $document);

        $document->clients()->detach($client->id);
        $document->touch();

        return response()->json(['message' => 'Client detached from document successfully']);
    }
}
