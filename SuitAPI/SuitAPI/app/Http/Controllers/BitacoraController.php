<?php

namespace App\Http\Controllers;

use App\Http\Resources\BitacoraResource;
use App\Models\Bitacora;
use Illuminate\Http\Request;

class BitacoraController extends Controller
{
    /**
     * Display a paginated listing of the logs.
     */
    public function index(Request $request)
    {
        $this->authorizeAdmin();

        $query = Bitacora::query()->with([
            'user',
            'entity' => function ($morphTo) {
                $morphTo->morphWith([
                    'judicial_dependency' => ['jurisdiccion', 'competencia'],
                    'fee' => ['suitCase'],
                    'tax' => ['suitCases'],
                    'delivery' => ['honorario'],
                    'agenda' => ['suitCase'],
                ]);
            },
        ]);

        if ($request->has('entity_type')) {
            $query->where('entity_type', $request->entity_type);
        }

        $sort = $request->get('sort', 'newest');
        if ($sort === 'oldest') {
            $query->oldest();
        } else {
            $query->latest();
        }

        return BitacoraResource::collection($query->paginate(30));
    }

    /**
     * Clear all logs from the bitacora.
     */
    public function clear()
    {
        $this->authorizeAdmin();

        Bitacora::truncate();

        return response()->json(['message' => 'Bitácora limpiada correctamente.']);
    }

    /**
     * Keep logs from only the last N days.
     */
    public function cleanup(Request $request)
    {
        $this->authorizeAdmin();

        $request->validate([
            'days' => 'required|integer|min:0',
        ]);

        $days = (int) $request->days;
        $date = now()->subDays($days);

        $deleted = Bitacora::where('created_at', '<', $date)->delete();

        return response()->json([
            'message' => "Se han eliminado $deleted registros de la bitácora.",
            'deleted_count' => $deleted,
        ]);
    }

    /**
     * Internal helper to authorize admin access.
     */
    protected function authorizeAdmin(): void
    {
        if (! auth()->user() || ! auth()->user()->isAdmin()) {
            abort(403, 'No tienes permisos para acceder a la bitácora.');
        }
    }
}
