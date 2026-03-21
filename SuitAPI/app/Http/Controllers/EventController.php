<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Agenda;
use App\Models\Event;
use App\Models\EventType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'agenda_id' => ['required', 'exists:agendas,id'],
        ]);

        $agenda = Agenda::findOrFail($request->agenda_id);

        if (! $request->user()->can('view', $agenda)) {
            abort(403);
        }

        return response()->json(EventResource::collection($agenda->events));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreEventRequest $request): EventResource
    {
        $validated = $request->validated();

        if (is_null($validated['event_type_id'] ?? null)) {
            $validated['event_type_id'] = EventType::defaultType()->id;
        }

        $agenda = Agenda::findOrFail($validated['agenda_id']);

        if (! $request->user()->can('update', $agenda)) {
            abort(403);
        }

        $event = $agenda->events()->create($validated);

        return new EventResource($event);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): EventResource
    {
        $event = Event::with('agenda')->findOrFail($id);

        if (! request()->user()->can('view', $event)) {
            abort(403);
        }

        return new EventResource($event);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateEventRequest $request, string $id): EventResource
    {
        $event = Event::findOrFail($id);

        if (! $request->user()->can('update', $event)) {
            abort(403);
        }

        $validated = $request->validated();

        if (
            array_key_exists('event_type_id', $validated) &&
            is_null($validated['event_type_id'])
        ) {
            $validated['event_type_id'] = EventType::defaultType()->id;
        }

        $event->update($validated);

        return new EventResource($event);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $event = Event::findOrFail($id);

        if (! request()->user()->can('delete', $event)) {
            abort(403);
        }

        $event->delete();

        return response()->json(null, 204);
    }
}
