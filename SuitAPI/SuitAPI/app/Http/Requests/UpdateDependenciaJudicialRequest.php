<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDependenciaJudicialRequest extends FormRequest
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
            'jurisdiccion_id' => ['sometimes', 'exists:jurisdicciones,id'],
            'competencia_id' => ['sometimes', 'exists:competencias,id'],
            'radicacion_id' => ['sometimes', 'nullable', 'exists:radicaciones,id'],
            'nombre_juzgado' => ['sometimes', 'string', 'max:255'],
        ];
    }
}
