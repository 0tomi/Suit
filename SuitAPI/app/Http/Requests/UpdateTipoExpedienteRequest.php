<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateTipoExpedienteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('tipo_expediente'));
    }

    public function rules(): array
    {
        return [
            'titulo' => ['sometimes', 'string', 'max:255'],
            'detalles' => ['nullable', 'string'],
            'case_type_id' => ['nullable', 'exists:case_types,id'],
        ];
    }
}
