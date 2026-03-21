<?php

namespace App\Http\Controllers;

use App\Http\Resources\EventResource;
use App\Models\Agenda;
use App\Models\Event;
use App\Models\EventType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AgendaController extends Controller
{
    /**
     * Get events from Personal Agenda and associated Case Agendas.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $agendas = $user->role === 'admin'
            ? Agenda::query()->get()
            : $user->accessibleAgendas()->get();

        return response()->json($agendas);
    }

    /**
     * Get last modification date of a specific agenda.
     */
    public function status(string $id, Request $request): JsonResponse
    {
        $agenda = Agenda::findOrFail($id);
        $this->authorize('view', $agenda);

        return response()->json(['updated_at' => $agenda->updated_at]);
    }

    /**
     * Get latest event timestamp across all accessible agendas.
     */
    public function latestEvent(Request $request): JsonResponse
    {
        $user = $request->user();
        $allAgendaIds = $this->accessibleAgendaIds($user);

        $latestEvent = Event::whereIn('agenda_id', $allAgendaIds)
            ->latest('updated_at')
            ->first();

        return response()->json(['last_event_update' => $latestEvent ? $latestEvent->updated_at : null]);
    }

    /**
     * Restore events: Send all events updated after a specific date.
     */
    public function syncDown(Request $request): JsonResponse
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);
        $user = $request->user();
        $allAgendaIds = $this->accessibleAgendaIds($user);

        $events = Event::whereIn('agenda_id', $allAgendaIds)
            ->where('updated_at', '>=', $since)
            ->get();

        return response()->json(EventResource::collection($events));
    }

    /**
     * Receive events from client to update/create.
     */
    public function syncUp(Request $request): JsonResponse
    {
        $request->validate([
            'events' => 'required|array',
            'events.*.title' => 'required|string',
            'events.*.starts_at' => 'required|date',
            'events.*.agenda_id' => 'required|exists:agendas,id',
            'events.*.event_type_id' => 'nullable|exists:event_types,id',
        ]);

        $user = $request->user();
        $syncedEvents = [];

        foreach ($request->events as $eventData) {
            $hasEventType = array_key_exists('event_type_id', $eventData);

            if (! $hasEventType && ! isset($eventData['id'])) {
                $eventData['event_type_id'] = EventType::defaultType()->id;
            }

            if ($hasEventType && is_null($eventData['event_type_id'])) {
                $eventData['event_type_id'] = EventType::defaultType()->id;
            }

            $agenda = Agenda::find($eventData['agenda_id']);
            if (! $agenda) {
                continue;
            }

            if (! $user->can('update', $agenda)) {
                continue;
            }

            if (isset($eventData['id'])) {
                $event = Event::find($eventData['id']);
                if ($event && $event->agenda_id == $agenda->id) {
                    $event->update($eventData);
                    $syncedEvents[] = $event;
                }
            } else {
                $event = $agenda->events()->create($eventData);
                $syncedEvents[] = $event;
            }

            $agenda->touch();
        }

        return response()->json(['synced' => EventResource::collection(collect($syncedEvents))]);
    }

    /**
     * Get all events from all accessible agendas.
     */
    public function allEvents(Request $request, ?string $month = null, ?string $year = null): JsonResponse
    {
        $user = $request->user();
        $allAgendaIds = $this->accessibleAgendaIds($user);

        if ($month !== null && $year !== null) {
            [$start, $end] = $this->monthBounds((int) $year, (int) $month);
        } else {
            [$start, $end] = $this->monthBoundsWithNextMonth();
        }

        $events = Event::whereIn('agenda_id', $allAgendaIds)
            ->whereDate('starts_at', '>=', $start->toDateString())
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->get();

        return response()->json(EventResource::collection($events));
    }

    /**
     * Get events from a specific agenda in the current month.
     */
    public function agendaEvents(Agenda $agenda): JsonResponse
    {
        $this->authorize('view', $agenda);

        [$start, $end] = $this->monthBounds(now()->year, now()->month);

        $events = $agenda->events()
            ->whereDate('starts_at', '>=', $start->toDateString())
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->get();

        return response()->json(EventResource::collection($events));
    }

    /**
     * Get events from a specific agenda by month and year.
     */
    public function agendaEventsByMonth(Agenda $agenda, string $month, string $year): JsonResponse
    {
        $this->authorize('view', $agenda);

        $validated = $this->validateYearMonth($year, $month);
        [$start, $end] = $this->monthBounds((int) $validated['year'], (int) $validated['month']);

        $events = $agenda->events()
            ->whereDate('starts_at', '>=', $start->toDateString())
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->get();

        return response()->json(EventResource::collection($events));
    }

    /**
     * Get all events from accessible agendas filtered by event type and month/year.
     */
    public function allEventsByType(Request $request, EventType $eventType, string $month, string $year): JsonResponse
    {
        $user = $request->user();
        $allAgendaIds = $this->accessibleAgendaIds($user);

        $validated = $this->validateYearMonth($year, $month);
        [$start, $end] = $this->monthBounds((int) $validated['year'], (int) $validated['month']);

        $events = Event::whereIn('agenda_id', $allAgendaIds)
            ->where('event_type_id', $eventType->id)
            ->whereDate('starts_at', '>=', $start->toDateString())
            ->whereDate('starts_at', '<=', $end->toDateString())
            ->get();

        return response()->json(EventResource::collection($events));
    }

    /**
     * Shortcut to get all events of type "Vencimiento" for the given month/year.
     */
    public function allVencimientos(Request $request, string $month, string $year): JsonResponse
    {
        $vencimientoType = EventType::where('name', 'Vencimiento')->firstOrFail();

        return $this->allEventsByType($request, $vencimientoType, $month, $year);
    }

    private function accessibleAgendaIds(mixed $user): array
    {
        if ($user->role === 'admin') {
            return Agenda::query()->pluck('id')->all();
        }

        return $user->accessibleAgendas()
            ->pluck('agendas.id')
            ->all();
    }

    private function monthBounds(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        return [$start, $end];
    }

    private function monthBoundsWithNextMonth(): array
    {
        $start = now()->startOfMonth();
        $end = now()->addMonth()->endOfMonth();

        return [$start, $end];
    }

    private function validateYearMonth(string $year, string $month): array
    {
        return validator(
            ['year' => $year, 'month' => $month],
            [
                'year' => ['required', 'integer', 'digits:4'],
                'month' => ['required', 'integer', 'between:1,12'],
            ]
        )->validate();
    }
}
