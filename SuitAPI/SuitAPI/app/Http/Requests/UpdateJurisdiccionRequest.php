<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateJurisdiccionRequest extends FormRequest
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
        $jurisdiccion = $this->route('jurisdiccion');
        $id = ($jurisdiccion instanceof \App\Models\Jurisdiccion) ? $jurisdiccion->id : $jurisdiccion;

        return [
            'nombre' => ['sometimes', 'string', 'max:255', 'unique:jurisdicciones,nombre,'.$id],
        ];
    }
}
