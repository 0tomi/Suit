<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProrrogarDeadlineRequest;
use App\Http\Requests\StoreDeadlineRequest;
use App\Http\Requests\UpdateDeadlineRequest;
use App\Http\Resources\DeadlineResource;
use App\Models\Agenda;
use App\Models\Deadline;
use App\Models\Event;
use App\Models\EventType;
use App\Models\SuitCase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DeadlineController extends Controller
{
    /**
     * Listar todos los vencimientos del mes/año indicados,
     * filtrando según las agendas accesibles por el usuario autenticado.
     */
    public function index(Request $request, string $month, string $year): JsonResponse
    {
        $user = $request->user();

        $validated = $this->validateYearMonth($year, $month);

        $agendaIds = $this->accessibleAgendaIds($user);

        $deadlines = Deadline::forMonthInAgendas(
            (int) $validated['month'],
            (int) $validated['year'],
            $agendaIds
        )->each(fn (Deadline $d) => $d->inferState());

        $deadlines->load(['event.notifications' => fn ($query) => $query->where('user_id', $user->id)]);

        return response()->json(DeadlineResource::collection($deadlines));
    }

    /**
     * Crear un nuevo vencimiento.
     * Si no se especifica event_id, se crea un evento automático de tipo "Vencimiento".
     */
    public function store(StoreDeadlineRequest $request): DeadlineResource
    {
        $validated = $request->validated();
        $user = $request->user();

        if (! empty($validated['event_id'])) {
            $event = Event::with('agenda')->findOrFail($validated['event_id']);

            if (! $user->can('update', $event)) {
                abort(403);
            }
        } else {
            $event = $this->createImplicitEvent($validated, $user);
        }

        $isManuallyUrgent = ($validated['priority'] ?? null) === Deadline::PRIORITY_URGENT;

        $deadline = Deadline::create([
            'event_id' => $event->id,
            'title' => $validated['title'] ?? $validated['description'] ?? 'Vencimiento',
            'description' => $validated['description'] ?? null,
            'due_date' => $validated['due_date'],
            'priority' => $validated['priority'] ?? Deadline::PRIORITY_NORMAL,
            'manually_urgent' => $isManuallyUrgent,
        ]);

        if (array_key_exists('notify_at', $validated)) {
            if ($validated['notify_at']) {
                $event->notifications()->updateOrCreate(
                    ['user_id' => $user->id],
                    ['notify_at' => $validated['notify_at']]
                );
            } else {
                $event->notifications()->where('user_id', $user->id)->delete();
            }
        }

        $deadline->load(['event.notifications' => fn ($query) => $query->where('user_id', $user->id)]);

        return new DeadlineResource($deadline);
    }

    /**
     * Mostrar un vencimiento con estado inferido.
     */
    public function show(Request $request, Deadline $deadline): DeadlineResource
    {
        $this->authorize('view', $deadline);

        $deadline->load(['event.notifications' => fn ($q) => $q->where('user_id', $request->user()->id)]);
        $deadline->inferState();

        return new DeadlineResource($deadline);
    }

    /**
     * Actualizar los campos editables de un vencimiento (prioridad, status, descripción, título).
     */
    public function update(UpdateDeadlineRequest $request, Deadline $deadline): DeadlineResource
    {
        $this->authorize('update', $deadline);

        $validated = $request->validated();
        unset($validated['status']); // Block direct status update

        $user = $request->user();

        // Sincronizar manually_urgent si el usuario está cambiando la prioridad explícitamente.
        if (array_key_exists('priority', $validated)) {
            $validated['manually_urgent'] = $validated['priority'] === Deadline::PRIORITY_URGENT;
        }

        $deadline->update($validated);
        $deadline->inferState();

        if (array_key_exists('notify_at', $validated)) {
            if ($validated['notify_at']) {
                $deadline->event->notifications()->updateOrCreate(
                    ['user_id' => $user->id],
                    ['notify_at' => $validated['notify_at']]
                );
            } else {
                $deadline->event->notifications()->where('user_id', $user->id)->delete();
            }
        }

        $deadline->load(['event.notifications' => fn ($query) => $query->where('user_id', $user->id)]);

        return new DeadlineResource($deadline);
    }

    /**
     * Eliminar un vencimiento (se registra en la tombstone automáticamente por el modelo).
     */
    public function destroy(Deadline $deadline): JsonResponse
    {
        $this->authorize('delete', $deadline);

        $deadline->delete();

        return response()->json(null, 204);
    }

    /**
     * Marcar el vencimiento como Cumplido.
     * Esta es la única forma de alcanzar el estado Cumplido.
     */
    public function completar(Request $request, Deadline $deadline): DeadlineResource
    {
        $this->authorize('update', $deadline);

        $deadline->update(['status' => Deadline::STATUS_COMPLETED]);
        $deadline->load(['event.notifications' => fn ($q) => $q->where('user_id', $request->user()->id)]);

        return new DeadlineResource($deadline);
    }

    /**
     * Prorrogar un vencimiento: establece una nueva fecha futura y pasa al estado Prorrogado.
     * Solo aplica si el vencimiento está en estado Vencido.
     */
    public function prorrogar(ProrrogarDeadlineRequest $request, Deadline $deadline): DeadlineResource
    {
        $this->authorize('update', $deadline);

        // Aseguramos que el estado actual sea Vencido antes de prorrogar.
        $deadline->inferState();

        if ($deadline->status !== Deadline::STATUS_OVERDUE) {
            abort(422, 'Solo se puede prorrogar un vencimiento con estado Vencido.');
        }

        $validated = $request->validated();

        // Si se envía priority=Urgente, se mantiene la marca manual; en caso contrario se resetea
        // para que la nueva fecha se evalúe normalmente en la inferencia automática.
        $isManuallyUrgent = ($validated['priority'] ?? null) === Deadline::PRIORITY_URGENT;

        $deadline->update([
            'due_date' => $validated['due_date'],
            'status' => Deadline::STATUS_EXTENDED,
            'priority' => $isManuallyUrgent ? Deadline::PRIORITY_URGENT : Deadline::PRIORITY_NORMAL,
            'manually_urgent' => $isManuallyUrgent,
        ]);

        $deadline->load(['event.notifications' => fn ($q) => $q->where('user_id', $request->user()->id)]);

        return new DeadlineResource($deadline);
    }

    /**
     * Crea el evento implícito de tipo "Vencimiento" al crear un vencimiento sin event_id.
     * Infiere la agenda a partir del caso (si fue especificado) o usa la agenda personal del usuario.
     */
    private function createImplicitEvent(array $validated, mixed $user): Event
    {
        $agenda = $this->resolveAgenda($validated, $user);

        $vencimientoType = EventType::firstOrCreate(
            ['name' => 'Vencimiento'],
            ['color' => null]
        );

        $title = $validated['title'] ?? $validated['description'] ?? 'Vencimiento';

        $isAllDay = Carbon::parse($validated['due_date'])->isMidnight();

        return $agenda->events()->create([
            'event_type_id' => $vencimientoType->id,
            'title' => $title,
            'description' => $validated['description'] ?? null,
            'starts_at' => $validated['due_date'],
            'is_all_day' => $isAllDay,
            'suit_case_id' => $validated['suit_case_id'] ?? null,
        ]);
    }

    /**
     * Resuelve la agenda a usar según si se especificó un caso o no.
     * Si se especifica un caso, usa la agenda de ese caso (debe existir).
     * Si no, usa la agenda personal del usuario autenticado.
     */
    private function resolveAgenda(array $validated, mixed $user): Agenda
    {
        if (! empty($validated['suit_case_id'])) {
            $suitCase = SuitCase::findOrFail($validated['suit_case_id']);

            $agenda = $suitCase->agenda;

            if (! $agenda) {
                abort(422, 'El caso especificado no tiene una agenda asociada.');
            }

            if (! $user->can('update', $agenda)) {
                abort(403, 'This action is unauthorized.');
            }

            return $agenda;
        }

        // Agenda personal del usuario autenticado
        $agenda = Agenda::where('user_id', $user->id)->whereNull('suit_case_id')->first();

        if (! $agenda) {
            abort(422, 'No se encontró una agenda personal para el usuario.');
        }

        return $agenda;
    }

    private function accessibleAgendaIds(mixed $user): array
    {
        if ($user->role === 'admin') {
            return Agenda::query()->pluck('id')->all();
        }

        return $user->accessibleAgendas()->pluck('agendas.id')->all();
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
