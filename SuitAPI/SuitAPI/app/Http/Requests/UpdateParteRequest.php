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
            'rol_id' => ['sometimes', 'exists:roles,id'],
        ];
    }
}
