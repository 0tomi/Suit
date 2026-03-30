<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Http\Resources\ClientResource;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\EventResource;
use App\Http\Resources\FileResource;
use App\Http\Resources\GastoSuitCaseResource;
use App\Http\Resources\HonorarioResource;
use App\Http\Resources\MultimediaResource;
use App\Http\Resources\ParteResource;
use App\Http\Resources\SuitCaseResource;
use App\Http\Resources\TipoExpedienteResource;
use App\Http\Resources\UserResource;
use App\Models\Agenda;
use App\Models\SuitCase;
use App\Models\User;
use App\Services\BitacoraService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

class CaseController extends Controller
{
    use ChecksForConflict;

    public function __construct(protected BitacoraService $bitacora) {}

    public function index(Request $request)
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        // Return cases where user is creator or participant
        $query = SuitCase::with('creator')->accessibleBy($user);

        $this->applyFilters($query, $request);
        $paginated = $query->paginate(40);
        $paginated->setCollection($paginated->getCollection()->map(fn ($case) => new SuitCaseResource($case)));

        return response()->json($paginated);
    }

    /**
     * Return all cases (including soft-deleted) modified after the given `since` timestamp.
     * Used by the offline client to fetch incremental changes and detect remotely-deleted records.
     */
    public function syncDown(Request $request)
    {
        $this->authorize('viewAny', SuitCase::class);

        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);
        $user = Auth::user();

        $query = SuitCase::withTrashed()
            ->with([
                'creator',
                'type',
                'radicacion',
                'dependenciaJudicial.jurisdiccion',
                'dependenciaJudicial.competencia',
                'dependenciaJudicial.radicacion',
                'participants',
                'tipoExpedientes',
            ])
            ->where('updated_at', '>=', $since);

        if ($user->role !== 'admin') {
            $query->where(function ($q) use ($user) {
                $q->where('lawyer_id', $user->id)
                    ->orWhereHas('participants', fn ($sq) => $sq->whereKey($user->id)->withTrashed());
            });
        }

        return SuitCaseResource::collection($query->get());
    }

    /**
     * Return all artifacts for a specific case modified after the given date.
     */
    public function caseSyncDown(SuitCase $case, string $date)
    {
        $this->authorize('view', $case);

        try {
            $since = Carbon::parse($date);
        } catch (\Carbon\Exceptions\InvalidFormatException $e) {
            return response()->json(['message' => 'El formato de fecha proveído es inválido.'], 400);
        }

        return response()->json([
            'partes' => ParteResource::collection(
                $case->partes()->withTrashed()->with(['persona', 'rol'])->where(function ($q) use ($since) {
                    $q->where('partes.updated_at', '>=', $since)
                        ->orWhere('parte_caso.updated_at', '>=', $since);
                })->get()
            ),
            'gastos' => GastoSuitCaseResource::collection(
                $case->gastos()->withTrashed()->with('type')->where('updated_at', '>=', $since)->get()
            ),
            'honorarios' => HonorarioResource::collection(
                $case->honorarios()->withTrashed()->where('updated_at', '>=', $since)->get()
            ),
            'documentos' => DocumentResource::collection(
                $case->documents()->withTrashed()->with(['latestVersion.creator', 'locker'])->where('updated_at', '>=', $since)->get()
            ),
            'eventos' => EventResource::collection(
                $case->events()->where('updated_at', '>=', $since)->get()
            ),
            'clientes' => ClientResource::collection(
                $case->clients()->withTrashed()->with('persona')->where(function ($q) use ($since) {
                    $q->where('clients.updated_at', '>=', $since)
                        ->orWhere('case_client.updated_at', '>=', $since);
                })->get()
            ),
            'multimedia' => MultimediaResource::collection(
                $case->multimedia()->withTrashed()->where('updated_at', '>=', $since)->get()
            ),
            'archivos' => FileResource::collection(
                $case->files()->withTrashed()->where('updated_at', '>=', $since)->get()
            ),
            'tipo_expedientes' => TipoExpedienteResource::collection(
                $case->tipoExpedientes()->where('suit_case_tipo_expediente.updated_at', '>=', $since)->get()
            ),
            'participants' => UserResource::collection(
                $case->participants()->where('case_permissions.updated_at', '>=', $since)->get()
            ),
        ]);
    }

    /**
     * Receive multiple cases from client offline database to update/create them.
     */
    public function syncUp(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->authorize('create', SuitCase::class);

        $request->validate([
            'cases' => 'required|array',
            'cases.*.title' => 'required|string',
            'cases.*.nro_expediente' => 'required|string',
            'cases.*.radicacion_id' => 'required|exists:radicaciones,id',
            'cases.*.dependencia_id' => 'nullable|exists:dependencias_judiciales,id',
        ]);

        $synced = [];
        $conflicts = [];
        $user = Auth::user();

        foreach ($request->cases as $caseData) {
            try {
                // Federal Business Rule
                $radicacion = \App\Models\Radicacion::findOrFail($caseData['radicacion_id']);
                if ($radicacion->tipo === 'Federal') {
                    if (! isset($caseData['dependencia_id']) || ! $caseData['dependencia_id']) {
                        continue;
                    }
                    $dependencia = \App\Models\DependenciaJudicial::findOrFail($caseData['dependencia_id']);
                    if ($dependencia->jurisdiccion->nombre !== 'Federal') {
                        continue;
                    }
                }

                if (isset($caseData['id']) && $caseData['id']) {
                    // Update
                    $case = SuitCase::find($caseData['id']);
                    if ($case) {
                        try {
                            $this->checkForConflict($case, $caseData);
                            $case->update($caseData);
                            $synced[] = clone $case;
                        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                            if ($e->getStatusCode() === 409) {
                                $conflicts[] = $caseData['id'];
                            } else {
                                throw $e;
                            }
                        }
                    }
                } else {
                    // Create
                    if (! isset($caseData['lawyer_id'])) {
                        $caseData['lawyer_id'] = $user->id;
                    }
                    $case = SuitCase::create($caseData);

                    Agenda::create([
                        'suit_case_id' => $case->id,
                        'title' => "Agenda for {$case->title}",
                    ]);

                    $synced[] = $case;

                    $this->bitacora->record('created', $case);
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        return response()->json([
            'synced' => $synced,
            'conflicts' => $conflicts,
        ]);
    }

    public function openCases(Request $request)
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        $query = SuitCase::with('creator')->accessibleBy($user)->ofStatus('active');

        $this->applyFilters($query, $request);
        $paginated = $query->paginate(40);
        $paginated->setCollection($paginated->getCollection()->map(fn ($case) => new SuitCaseResource($case)));

        return response()->json($paginated);
    }

    public function closedCases(Request $request)
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        $query = SuitCase::with('creator')->accessibleBy($user)->ofStatus('closed');

        $this->applyFilters($query, $request);
        $paginated = $query->paginate(40);
        $paginated->setCollection($paginated->getCollection()->map(fn ($case) => new SuitCaseResource($case)));

        return response()->json($paginated);
    }

    protected function applyFilters($query, Request $request)
    {
        if ($request->has('search')) {
            $query->where('title', 'like', '%'.$request->search.'%');
        }

        if ($request->has('case_type_id')) {
            $query->where('case_type_id', $request->input('case_type_id'));
        }
        if ($request->has('radicacion_id')) {
            $query->where('radicacion_id', $request->input('radicacion_id'));
        }
        if ($request->has('dependencia_id')) {
            $query->where('dependencia_id', $request->input('dependencia_id'));
        }
        if ($request->has('owner_id')) {
            $query->where('lawyer_id', $request->input('owner_id'));
        }
        if ($request->has('participant_id')) {
            $query->whereHas('participants', function ($q) use ($request) {
                $q->where('users.id', $request->input('participant_id'));
            });
        }
        if ($request->has('start_date_from')) {
            $query->whereDate('start_date', '>=', $request->input('start_date_from'));
        }
        if ($request->has('start_date_to')) {
            $query->whereDate('start_date', '<=', $request->input('start_date_to'));
        }
        if ($request->has('end_date_from')) {
            $query->whereDate('end_date', '>=', $request->input('end_date_from'));
        }
        if ($request->has('end_date_to')) {
            $query->whereDate('end_date', '<=', $request->input('end_date_to'));
        }
        if ($request->has('status')) {
            $query->ofStatus($request->input('status'));
        }

        return $query;
    }

    public function store(Request $request)
    {
        $this->authorize('create', SuitCase::class);

        $request->validate([
            'title' => 'required|string',
            'case_type_id' => 'required|exists:case_types,id',
            'start_date' => 'required|date_format:Y-m-d',
            'details' => 'nullable|string',
            'nro_expediente' => 'required|string',
            'radicacion_id' => 'required|exists:radicaciones,id',
            'dependencia_id' => 'nullable|exists:dependencias_judiciales,id',
        ]);

        // Federal Business Rule
        $radicacion = \App\Models\Radicacion::findOrFail($request->radicacion_id);
        if ($radicacion->tipo === 'Federal') {
            if (! $request->dependencia_id) {
                return response()->json(['message' => 'Para radicaciones Federales, la dependencia judicial es obligatoria.'], 422);
            }
            $dependencia = \App\Models\DependenciaJudicial::findOrFail($request->dependencia_id);
            if ($dependencia->jurisdiccion->nombre !== 'Federal') {
                return response()->json(['message' => 'Para radicaciones Federales, la dependencia debe pertenecer a la jurisdicción Federal.'], 422);
            }
        }

        $user = Auth::user();

        $case = SuitCase::create([
            'title' => $request->title,
            'case_type_id' => $request->case_type_id,
            'lawyer_id' => $user->id,
            'start_date' => $request->start_date,
            'details' => $request->details,
            'status' => 'active',
            'nro_expediente' => $request->nro_expediente,
            'radicacion_id' => $request->radicacion_id,
            'dependencia_id' => $request->dependencia_id,
        ]);

        // Create Agenda for Case
        $agenda = Agenda::create([
            'name' => 'Agenda: '.$case->title,
            'user_id' => $user->id,
            'suit_case_id' => $case->id,
        ]);

        // Calculate last modified for cases
        $casesLastModified = SuitCase::getLastModifiedForUser($user);

        // Calculate last modified for agendas
        $agendaLastModified = $user->accessibleAgendas()->max('agendas.updated_at');
        $accessLastModified = $user->accessibleAgendas()->max('agenda_user.updated_at');
        $agendasLastModified = collect([$agendaLastModified, $accessLastModified])
            ->filter()
            ->map(fn ($timestamp) => Carbon::parse($timestamp))
            ->max();

        // Ensure the case relations are loaded as before
        $case->load('agenda');

        $this->bitacora->record('created', $case);

        return (new SuitCaseResource($case->load('agenda')))
            ->additional([
                'cases_last_modified' => $casesLastModified ? Carbon::parse($casesLastModified) : null,
                'agendas_last_modified' => $agendasLastModified?->format('Y-m-d H:i:s'),
            ]);
    }

    public function show($id)
    {
        $case = SuitCase::with(['creator', 'type', 'radicacion', 'dependenciaJudicial'])->findOrFail($id);
        $this->authorize('view', $case);

        return new SuitCaseResource($case);
    }

    public function update(Request $request, $id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('update', $case);

        $request->validate([
            'title' => 'string',
            'details' => 'string',
            'start_date' => 'date_format:Y-m-d',
            'case_type_id' => 'exists:case_types,id',
            'nro_expediente' => 'required|string',
            'radicacion_id' => 'required|exists:radicaciones,id',
            'dependencia_id' => 'nullable|exists:dependencias_judiciales,id',
            'last_updated_at' => 'nullable|date',
        ]);

        // Federal Business Rule
        $radicacion_id = $request->radicacion_id ?? $case->radicacion_id;
        $dependencia_id = $request->has('dependencia_id') ? $request->dependencia_id : $case->dependencia_id;

        $radicacion = \App\Models\Radicacion::findOrFail($radicacion_id);
        if ($radicacion->tipo === 'Federal') {
            if (! $dependencia_id) {
                return response()->json(['message' => 'Para radicaciones Federales, la dependencia judicial es obligatoria.'], 422);
            }
            $dependencia = \App\Models\DependenciaJudicial::findOrFail($dependencia_id);
            if ($dependencia->jurisdiccion->nombre !== 'Federal') {
                return response()->json(['message' => 'Para radicaciones Federales, la dependencia debe pertenecer a la jurisdicción Federal.'], 422);
            }
        }

        $this->checkForConflict($case, $request);

        $case->update($request->only(['title', 'details', 'start_date', 'case_type_id', 'nro_expediente', 'radicacion_id', 'dependencia_id']));

        $this->bitacora->record('updated', $case);

        return new SuitCaseResource($case->load(['creator', 'type', 'radicacion', 'dependenciaJudicial']));
    }

    public function close($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('close', $case);

        $case->update([
            'end_date' => now(),
            'status' => 'closed',
        ]);

        $this->bitacora->record('closed', $case);

        // Recalcular estado de los clientes asociados
        $case->recalculateClientsStatus();

        return response()->json($case);
    }

    public function reopen($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('update', $case);

        $case->update([
            'end_date' => null,
            'status' => 'active',
        ]);

        $this->bitacora->record('reopened', $case);

        // Recalcular estado de los clientes asociados
        $case->recalculateClientsStatus();

        return response()->json($case);
    }

    public function addParticipant(Request $request, $id)
    {
        $request->validate([
            'user_tag' => 'required|exists:users,tag',
            'permission_level' => 'required|string',
        ]);

        $case = SuitCase::findOrFail($id);
        $this->authorize('update', $case);

        $user = User::where('tag', $request->user_tag)->firstOrFail();

        $case->participants()->attach($user->id, [
            'permission_level' => $request->permission_level,
        ]);

        $case->agenda?->users()->syncWithoutDetaching([$user->id]);
        $case->touch();

        $this->bitacora->record('participant_added', $case);

        return response()->json(['message' => 'Participant added']);
    }

    public function removeParticipant($id, $userId)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('update', $case);

        $user = User::findOrFail($userId);

        $case->participants()->detach($user->id);

        // Also remove from case agenda if present
        $case->agenda?->users()->detach($user->id);

        $case->touch();

        $this->bitacora->record('participant_removed', $case);

        return response()->json(['message' => 'Participant removed']);
    }

    /**
     * Get all participants including the owner (lawyer).
     */
    public function getParticipants($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('view', $case);

        return response()->json($case->allParticipants);
    }

    public function getAgenda($id)
    {
        $case = SuitCase::findOrFail($id);

        $this->authorize('viewAgenda', $case);

        $agenda = $case->agenda()->with('events')->first();

        return response()->json($agenda);
    }

    public function destroy($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('delete', $case);

        $this->bitacora->record('deleted', $case);

        $case->delete();

        // Recalcular estado de los clientes asociados (después de eliminar el caso)
        $case->recalculateClientsStatus();

        return response()->json(null, 204);
    }

    /**
     * Search for cases by title. Returns the first 20 matches.
     */
    public function search(Request $request)
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        $query = SuitCase::with('creator')->accessibleBy($user);

        $this->applyFilters($query, $request);

        $cases = $query->limit(20)->get();

        return SuitCaseResource::collection($cases);
    }
}
