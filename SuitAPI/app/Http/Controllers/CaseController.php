<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Models\Agenda;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

class CaseController extends Controller
{
    use ChecksForConflict;

    public function index()
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        // Return cases where user is creator or participant
        $cases = SuitCase::getForUser($user, null);

        return response()->json($cases);
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

        $query = SuitCase::withTrashed()->where('updated_at', '>=', $since);

        if ($user->role !== 'admin') {
            $query->where(function ($q) use ($user) {
                $q->where('lawyer_id', $user->id)
                    ->orWhereHas('participants', fn ($sq) => $sq->where('users.id', $user->id));
            });
        }

        return response()->json($query->get());
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
            'partes' => $case->partes()->withTrashed()->where(function ($q) use ($since) {
                $q->where('partes.updated_at', '>=', $since)
                    ->orWhere('parte_caso.updated_at', '>=', $since);
            })->get(),
            'gastos' => $case->gastos()->withTrashed()->where('updated_at', '>=', $since)->get(),
            'honorarios' => $case->honorarios()->withTrashed()->where('updated_at', '>=', $since)->get(),
            'documentos' => $case->documents()->withTrashed()->where('updated_at', '>=', $since)->get(),
            'eventos' => $case->events()->where('updated_at', '>=', $since)->get(),
            'clientes' => $case->clients()->withTrashed()->where(function ($q) use ($since) {
                $q->where('clients.updated_at', '>=', $since)
                    ->orWhere('case_client.updated_at', '>=', $since);
            })->get(),
            'multimedia' => $case->multimedia()->withTrashed()->where('updated_at', '>=', $since)->get(),
            'archivos' => $case->files()->withTrashed()->where('updated_at', '>=', $since)->get(),
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
        ]);

        $synced = [];
        $conflicts = [];
        $user = Auth::user();

        foreach ($request->cases as $caseData) {
            try {
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

    public function openCases()
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        $cases = SuitCase::getForUser($user, 'active');

        return response()->json($cases);
    }

    public function closedCases()
    {
        $this->authorize('viewAny', SuitCase::class);

        $user = Auth::user();
        $cases = SuitCase::getForUser($user, 'closed');

        return response()->json($cases);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string',
            'case_type_id' => 'required|exists:case_types,id',
            'start_date' => 'required|date_format:Y-m-d',
            'details' => 'nullable|string',
            'nro_expediente' => 'required|string',
            'radicacion_id' => 'required|exists:radicaciones,id',
        ]);

        $this->authorize('create', SuitCase::class);

        $user = Auth::user();

        $case = SuitCase::create([
            'title' => $request->title,
            'lawyer_id' => $user->id,
            'case_type_id' => $request->case_type_id,
            'start_date' => $request->start_date,
            'details' => $request->details,
            'nro_expediente' => $request->nro_expediente,
            'radicacion_id' => $request->radicacion_id,
            'status' => 'active',
        ]);

        // Create Agenda for Case
        // User ID is the creator (lawyer)
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

        return response()->json([
            'case' => $case,
            'agenda' => $agenda,
            'cases_last_modified' => $casesLastModified ? Carbon::parse($casesLastModified) : null,
            'agendas_last_modified' => $agendasLastModified?->format('Y-m-d H:i:s'),
        ], 201);
    }

    public function show($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('view', $case);

        return response()->json($case);
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
            'last_updated_at' => 'nullable|date',
        ]);

        $this->checkForConflict($case, $request);

        $case->update($request->only(['title', 'details', 'start_date', 'case_type_id', 'nro_expediente', 'radicacion_id']));

        return response()->json($case);
    }

    public function close($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('close', $case);

        $case->update([
            'end_date' => now(),
            'status' => 'closed',
        ]);

        return response()->json($case);
    }

    public function reopen($id)
    {
        $case = SuitCase::findOrFail($id);
        $this->authorize('update', $case);

        $case->update([
            'end_date' => null,
            'status' => 'active', // o 'open'
        ]);

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

        $case->delete();

        return response()->json(null, 204);
    }
}
