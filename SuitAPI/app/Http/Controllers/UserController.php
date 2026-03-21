<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    /**
     * Listar todos los usuarios. (Acceso restringido por permisos a nivel de app)
     */
    public function index(Request $request)
    {
        return response()->json(User::publicProfile()->paginate(15));
    }

    /**
     * Obtener el perfil público de un usuario.
     */
    public function show(User $user)
    {
        return response()->json(User::publicProfile()->findOrFail($user->id));
    }

    /**
     * Eliminar un usuario (Baja Lógica).
     */
    public function destroy(Request $request, User $user)
    {
        if ($request->user()->cannot('delete', $user) || $request->user()->id === $user->id) {
            abort(403, 'Unauthorized action or cannot delete yourself.');
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($user, $request) {
            // Transferir Casos
            \App\Models\SuitCase::where('lawyer_id', $user->id)
                ->update(['lawyer_id' => $request->user()->id]);

            // Eliminar Agenda Personal y Eventos
            $personalAgenda = $user->personalAgenda;
            \App\Models\Event::where('agenda_id', $personalAgenda->id)->delete();
            $personalAgenda->delete();

            // Cambiar tag y email para liberar campos UNIQUE
            $user->update([
                'tag' => 'del_'.$user->id.'_'.$user->tag,
                'email' => $user->email ? 'del_'.$user->id.'_'.$user->email : null,
            ]);

            $user->delete(); // Soft delete
        });

        return response()->noContent();
    }

    /**
     * Buscar usuarios por tag o name.
     */
    public function search(Request $request)
    {
        $q = $request->query('query', $request->query('q', ''));

        $users = User::searchProfile($q)
            ->publicProfile()
            ->limit(20)
            ->get();

        return response()->json($users);
    }

    /**
     * Actualizar perfil de un usuario identificándolo por su tag.
     */
    public function updateByTag(\App\Http\Requests\UpdateUserByTagRequest $request, User $user)
    {
        $user->update($request->validated());

        return response()->json($user->fresh());
    }

    /**
     * Actualizar perfil del usuario autenticado (nombre, apellido y contraseña).
     */
    public function updateProfile(\App\Http\Requests\UpdateProfileRequest $request)
    {
        $user = $request->user();
        $user->update($request->validated());

        return response()->json($user->fresh());
    }

    /**
     * Subir foto de perfil (PNG o JPG).
     */
    public function uploadProfilePhoto(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png|max:4096',
        ]);

        $user = $request->user();

        // Eliminar foto anterior si existe
        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        $path = $request->file('photo')->store("profile-photos/{$user->id}", 'public');

        $user->update(['profile_photo_path' => $path]);

        return response()->json($user->fresh());
    }
}
