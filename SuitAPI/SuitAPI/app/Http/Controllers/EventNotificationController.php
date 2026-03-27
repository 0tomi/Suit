<?php

namespace App\Http\Controllers;

use App\Http\Resources\EventNotificationResource;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class EventNotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()->getAndCleanEventNotifications();

        return response()->json($notifications);
    }

    public function show(Request $request, Event $event): EventNotificationResource|JsonResponse
    {
        if (! $request->user()->can('view', $event)) {
            abort(403);
        }

        $notification = $request->user()->eventNotifications()
            ->where('event_id', $event->id)
            ->first();

        if (! $notification) {
            return response()->json([
                'event_id' => $event->id,
                'user_id' => $request->user()->id,
                'notify_at' => null,
                'created_at' => null,
                'updated_at' => null,
            ]);
        }

        return new EventNotificationResource($notification);
    }

    public function store(Request $request, Event $event): EventNotificationResource|JsonResponse
    {
        if (! $request->user()->can('view', $event)) {
            abort(403);
        }

        $validated = $request->validate([
            'notify_at' => ['required', 'date'],
        ]);

        $existing = $request->user()->eventNotifications()->where('event_id', $event->id)->first();

        if ($existing) {
            return response()->json([
                'message' => 'Ya existe una configuración de notificación para este evento.',
            ], 409);
        }

        $notification = $request->user()->eventNotifications()->create([
            'event_id' => $event->id,
            'notify_at' => Carbon::parse($validated['notify_at']),
        ]);

        return (new EventNotificationResource($notification))->response()->setStatusCode(201);
    }

    public function update(Request $request, Event $event): EventNotificationResource|JsonResponse
    {
        if (! $request->user()->can('view', $event)) {
            abort(403);
        }

        $validated = $request->validate([
            'notify_at' => ['required', 'date'],
        ]);

        $notification = $request->user()->eventNotifications()->where('event_id', $event->id)->first();

        if (! $notification) {
            return response()->json([
                'message' => 'No existe una configuración de notificación para este evento.',
            ], 404);
        }

        $notification->update([
            'notify_at' => Carbon::parse($validated['notify_at']),
        ]);

        return new EventNotificationResource($notification);
    }

    public function destroy(Request $request, Event $event): JsonResponse
    {
        if (! $request->user()->can('view', $event)) {
            abort(403);
        }

        $request->user()->eventNotifications()->where('event_id', $event->id)->delete();

        return response()->json(null, 204);
    }

    public function syncDown(Request $request): JsonResponse
    {
        $request->validate(['since' => 'required|date']);
        $since = Carbon::parse($request->since);

        $notifications = $request->user()->eventNotifications()
            ->with('event')
            ->where('updated_at', '>=', $since)
            ->get();

        return response()->json(EventNotificationResource::collection($notifications));
    }

    public function syncUp(Request $request): JsonResponse
    {
        $request->validate([
            'notifications' => 'required|array',
            'notifications.*.event_id' => 'required|exists:events,id',
            'notifications.*.notify_at' => 'required|date',
        ]);

        $synced = [];

        foreach ($request->notifications as $notifData) {
            $event = Event::find($notifData['event_id']);
            if (! $event || ! $request->user()->can('view', $event)) {
                continue;
            }

            $notification = $request->user()->eventNotifications()
                ->where('event_id', $event->id)
                ->first();

            $parsedNotifyAt = Carbon::parse($notifData['notify_at']);

            if ($notification) {
                if (isset($notifData['last_updated_at'])) {
                    $clientDate = Carbon::parse($notifData['last_updated_at']);
                    if ($notification->updated_at->gt($clientDate->addSeconds(1))) {
                        continue;
                    }
                }

                $notification->update(['notify_at' => $parsedNotifyAt]);
                $synced[] = $notification;
            } else {
                $notification = $request->user()->eventNotifications()->create([
                    'event_id' => $event->id,
                    'notify_at' => $parsedNotifyAt,
                ]);
                $synced[] = $notification;
            }
        }

        return response()->json(['synced' => EventNotificationResource::collection(collect($synced))]);
    }

    public function untilToday(Request $request): JsonResponse
    {
        $endOfToday = now()->endOfDay();

        $notifications = $request->user()->eventNotifications()
            ->with('event')
            ->whereNotNull('notify_at')
            ->where('notify_at', '<=', $endOfToday)
            ->get();

        if ($notifications->isNotEmpty()) {
            $request->user()->eventNotifications()
                ->whereIn('id', $notifications->pluck('id'))
                ->delete();
        }

        return response()->json(EventNotificationResource::collection($notifications));
    }

    public function lastModified(Request $request): JsonResponse
    {
        $lastModified = $request->user()->eventNotifications()->max('updated_at');

        return response()->json(['last_modified' => $lastModified]);
    }
}
