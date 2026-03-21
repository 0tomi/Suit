<?php

namespace App\Http\Controllers;

use App\Models\Agenda;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        if ($request->user()->cannot('create', User::class)) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'tag' => 'required|string|unique:users',
            'name' => 'required|string|max:255',
            'email' => 'nullable|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'nullable|in:user,lawyer,admin',
            'photo' => 'nullable|image|mimes:jpg,jpeg,png|max:4096',
        ]);

        $user = User::create([
            'name' => $request->name,
            'tag' => $request->tag,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->input('role', 'user'),
        ]);

        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store("profile-photos/{$user->id}", 'public');
            $user->update(['profile_photo_path' => $path]);
        }

        Agenda::create([
            'name' => 'Personal Agenda: '.$user->name,
            'user_id' => $user->id,
            'suit_case_id' => null,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function login(Request $request)
    {
        $request->validate([
            'tag' => 'required',
            'password' => 'required',
        ]);

        $user = User::where('tag', $request->tag)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'tag' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sesión cerrada correctamente.',
        ]);
    }
}
