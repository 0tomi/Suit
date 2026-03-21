<?php

namespace App\Http\Controllers;

use App\Models\PublicFile;
use App\Models\PublicFilePermission;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;

class PublicFilePermissionController extends Controller
{
    use AuthorizesRequests;

    /**
     * Display a listing of permissions for the given public file.
     */
    public function index(Request $request, $id)
    {
        $publicFile = PublicFile::findOrFail($id);
        if ($request->user()->id !== $publicFile->user_id && ! $request->user()->isAdmin()) {
            abort(403, 'Apenas el dueño del archivo (o un admin) puede ver los permisos.');
        }

        $permissions = PublicFilePermission::where('public_file_id', $publicFile->id)
            ->with('user:id,name,last_name,tag')
            ->get();

        return response()->json($permissions);
    }

    /**
     * Store or Update permission for a user on a public file.
     */
    public function store(Request $request, $id)
    {
        $publicFile = PublicFile::findOrFail($id);
        if ($request->user()->id !== $publicFile->user_id && ! $request->user()->isAdmin()) {
            abort(403, 'Apenas el dueño del archivo (o un admin) puede gestionar permisos.');
        }

        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'can_update' => ['boolean'],
            'can_delete' => ['boolean'],
        ]);

        $permission = PublicFilePermission::updateOrCreate(
            [
                'public_file_id' => $publicFile->id,
                'user_id' => $data['user_id'],
            ],
            [
                'can_update' => $data['can_update'] ?? false,
                'can_delete' => $data['can_delete'] ?? false,
            ]
        );

        return response()->json($permission);
    }

    /**
     * Remove the specified permission from storage.
     */
    public function destroy(Request $request, $id, string $user_id)
    {
        $publicFile = PublicFile::findOrFail($id);
        if ($request->user()->id !== $publicFile->user_id && ! $request->user()->isAdmin()) {
            abort(403, 'Apenas el dueño del archivo (o un admin) puede gestionar permisos.');
        }

        PublicFilePermission::where('public_file_id', $publicFile->id)
            ->where('user_id', $user_id)
            ->delete();

        return response()->noContent();
    }
}
