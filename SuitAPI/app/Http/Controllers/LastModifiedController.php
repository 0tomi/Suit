<?php

namespace App\Http\Controllers;

use App\Models\Agenda;
use App\Models\Client;
use App\Models\Deadline;
use App\Models\Document;
use App\Models\Event;
use App\Models\EventType;
use App\Models\SuitCase;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class LastModifiedController extends Controller
{
    /**
     * Last modification across all cases accessible by the authenticated user.
     */
    public function casesLastModified(Request $request): JsonResponse
    {
        $user = $request->user();

        $lastModified = SuitCase::getLastModifiedForUser($user);

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification of a specific case and its relations.
     */
    public function caseLastModified(SuitCase $case): JsonResponse
    {
        $this->authorize('view', $case);

        $maxPartes = max(
            $case->partes()->withTrashed()->max('partes.updated_at'),
            $case->partes()->withTrashed()->max('parte_caso.updated_at')
        );
        $maxGastos = $case->gastos()->withTrashed()->max('updated_at');
        $maxHonorarios = $case->honorarios()->withTrashed()->max('updated_at');
        $maxDocumentos = $case->documents()->withTrashed()->max('updated_at');
        $maxEventos = $case->events()->max('updated_at');
        $maxClientes = max(
            $case->clients()->withTrashed()->max('clients.updated_at'),
            $case->clients()->withTrashed()->max('case_client.updated_at')
        );
        $maxMultimedia = $case->multimedia()->withTrashed()->max('updated_at');
        $maxArchivos = $case->files()->withTrashed()->max('updated_at');

        return response()->json([
            'case' => $case->updated_at,
            'partes' => $maxPartes ? Carbon::parse($maxPartes)->toJSON() : null,
            'gastos' => $maxGastos ? Carbon::parse($maxGastos)->toJSON() : null,
            'honorarios' => $maxHonorarios ? Carbon::parse($maxHonorarios)->toJSON() : null,
            'documentos' => $maxDocumentos ? Carbon::parse($maxDocumentos)->toJSON() : null,
            'eventos' => $maxEventos ? Carbon::parse($maxEventos)->toJSON() : null,
            'clientes' => $maxClientes ? Carbon::parse($maxClientes)->toJSON() : null,
            'multimedia' => $maxMultimedia ? Carbon::parse($maxMultimedia)->toJSON() : null,
            'archivos' => $maxArchivos ? Carbon::parse($maxArchivos)->toJSON() : null,
        ]);
    }

    /**
     * Last modification across all documents accessible by the authenticated user.
     */
    public function documentsLastModified(Request $request): JsonResponse
    {
        $lastModified = Document::accessibleBy($request->user())
            ->max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification of a specific document.
     */
    public function documentLastModified(Document $document): JsonResponse
    {
        Gate::authorize('view', $document);

        return response()->json(['last_modified' => $document->updated_at]);
    }

    /**
     * Last modification across all clients.
     */
    public function clientsLastModified(): JsonResponse
    {
        $lastModified = Client::withTrashed()->max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification of a specific client.
     */
    public function clientLastModified(Client $client): JsonResponse
    {
        return response()->json(['last_modified' => $client->updated_at]);
    }

    /**
     * Last modification across all users.
     */
    public function usersLastModified(): JsonResponse
    {
        $lastModified = User::max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification of a specific user.
     */
    public function userLastModified(User $user): JsonResponse
    {
        return response()->json(['last_modified' => $user->updated_at]);
    }

    /**
     * Last modification across the agendas currently available to the authenticated user.
     * Includes permission updates so newly shared case agendas can be detected.
     */
    public function agendasLastModified(Request $request): JsonResponse
    {
        $user = $request->user();

        $lastModified = Agenda::getLastModifiedForUser($user);

        return response()->json([
            'last_modified' => $lastModified?->format('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Last modification for events in a specific agenda and month/year.
     */
    public function agendaMonthLastModified(Agenda $agenda, string $month, string $year): JsonResponse
    {
        $this->authorize('view', $agenda);

        $validated = validator(
            ['month' => $month, 'year' => $year],
            [
                'month' => ['required', 'integer', 'between:1,12'],
                'year' => ['required', 'integer', 'digits:4'],
            ]
        )->validate();

        $start = Carbon::create((int) $validated['year'], (int) $validated['month'], 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $lastModified = Event::query()
            ->where('agenda_id', $agenda->id)
            ->whereDate('starts_at', '>=', $start->toDateString())
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->max('updated_at');

        return response()->json([
            'last_modified' => $lastModified ? Carbon::parse($lastModified)->format('Y-m-d H:i:s') : null,
        ]);
    }

    /**
     * Last modification for all events across accessible agendas for a month/year.
     */
    public function allEventsLastModified(Request $request, ?string $month = null, ?string $year = null): JsonResponse
    {
        $user = $request->user();

        $allAgendaIds = $user->role === 'admin'
            ? Agenda::query()->pluck('id')->all()
            : $user->accessibleAgendas()->pluck('agendas.id')->all();

        if ($month !== null && $year !== null) {
            $validated = validator(
                ['month' => $month, 'year' => $year],
                [
                    'month' => ['required', 'integer', 'between:1,12'],
                    'year' => ['required', 'integer', 'digits:4'],
                ]
            )->validate();
            $start = Carbon::create((int) $validated['year'], (int) $validated['month'], 1)->startOfMonth();
            $end = $start->copy()->endOfMonth();
        } else {
            $start = now()->startOfMonth();
            $end = now()->addMonth()->endOfMonth();
        }

        $lastModified = Event::query()
            ->whereIn('agenda_id', $allAgendaIds)
            ->whereDate('starts_at', '>=', $start->toDateString())
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->max('updated_at');

        return response()->json([
            'last_modified' => $lastModified ? Carbon::parse($lastModified)->format('Y-m-d H:i:s') : null,
        ]);
    }

    /**
     * Last modification across all event types.
     */
    public function eventTypesLastModified(): JsonResponse
    {
        $lastModified = EventType::max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification across all templates.
     */
    public function templatesLastModified(): JsonResponse
    {
        $lastModified = \App\Models\Template::max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification across all template categories.
     */
    public function templateCategoriesLastModified(): JsonResponse
    {
        $lastModified = \App\Models\TemplateCategory::max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification of deadlines for the given month/year, across accessible agendas.
     */
    public function deadlinesLastModified(Request $request, string $month, string $year): JsonResponse
    {
        $user = $request->user();

        $validated = validator(
            ['month' => $month, 'year' => $year],
            [
                'month' => ['required', 'integer', 'between:1,12'],
                'year' => ['required', 'integer', 'digits:4'],
            ]
        )->validate();

        $allAgendaIds = $user->role === 'admin'
            ? Agenda::query()->pluck('id')->all()
            : $user->accessibleAgendas()->pluck('agendas.id')->all();

        $start = Carbon::create((int) $validated['year'], (int) $validated['month'], 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $lastModified = Deadline::query()
            ->whereHas('event', fn ($q) => $q->whereIn('agenda_id', $allAgendaIds))
            ->whereBetween('due_date', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->max('updated_at');

        return response()->json([
            'last_modified' => $lastModified ? Carbon::parse($lastModified)->format('Y-m-d H:i:s') : null,
        ]);
    }

    /**
     * Last modification across all gastos.
     */
    public function gastosLastModified(): JsonResponse
    {
        $lastModified = \App\Models\Gasto::max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }

    /**
     * Last modification across all tipo_expedientes.
     */
    public function tipoExpedientesLastModified(): JsonResponse
    {
        $lastModified = \App\Models\TipoExpediente::max('updated_at');

        return response()->json(['last_modified' => $lastModified ? Carbon::parse($lastModified) : null]);
    }
}
