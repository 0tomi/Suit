<?php

namespace App\Http\Controllers;

use App\Models\EventType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EventTypeController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', EventType::class);

        return response()->json(EventType::query()->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', EventType::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:event_types,name',
            'color' => 'nullable|string|max:15',
        ]);

        $type = EventType::create($validated);

        return response()->json($type, 201);
    }

    public function update(Request $request, EventType $eventType)
    {
        $this->authorize('update', $eventType);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('event_types', 'name')->ignore($eventType)],
            'color' => ['sometimes', 'nullable', 'string', 'max:15'],
        ]);

        if (
            array_key_exists('name', $validated) &&
            $validated['name'] !== $eventType->name
        ) {
            $this->authorize('rename', $eventType);
        }

        $eventType->update($validated);

        return response()->json($eventType->refresh());
    }

    public function destroy(EventType $eventType)
    {
        $this->authorize('delete', $eventType);

        if ($eventType->events()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar un tipo de evento en uso.',
            ], 422);
        }

        $eventType->delete();

        return response()->json(null, 204);
    }
}
