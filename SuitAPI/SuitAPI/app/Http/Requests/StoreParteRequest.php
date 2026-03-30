<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreParteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', \App\Models\Parte::class);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:255'],
            'apellido' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:255'],
            'identificacion' => ['nullable', 'string', 'max:255'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'genero' => ['nullable', 'string', 'max:255'],
            'estado' => ['nullable', 'string', 'max:255', 'in:activo,inactivo'],
            'notas' => ['nullable', 'string'],
            'rol_id' => ['required', 'exists:roles,id'],
        ];
    }
}
