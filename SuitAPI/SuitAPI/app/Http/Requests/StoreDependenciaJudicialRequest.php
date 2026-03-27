<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDependenciaJudicialRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jurisdiccion_id' => ['required', 'exists:jurisdicciones,id'],
            'competencia_id' => ['required', 'exists:competencias,id'],
            'radicacion_id' => ['nullable', 'exists:radicaciones,id'],
            'nombre_juzgado' => ['required', 'string', 'max:255'],
        ];
    }
}
