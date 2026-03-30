<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateParteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('parte'));
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'nombre' => ['sometimes', 'string', 'max:255'],
            'apellido' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'telefono' => ['sometimes', 'nullable', 'string', 'max:255'],
            'identificacion' => ['sometimes', 'nullable', 'string', 'max:255'],
            'direccion' => ['sometimes', 'nullable', 'string', 'max:255'],
            'genero' => ['sometimes', 'nullable', 'string', 'max:255'],
            'estado' => ['sometimes', 'nullable', 'string', 'max:255', 'in:activo,inactivo'],
            'notas' => ['sometimes', 'nullable', 'string'],
            'rol_id' => ['sometimes', 'exists:roles,id'],
        ];
    }
}
