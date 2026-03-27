<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateRadicacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('radicacion'));
    }

    public function rules(): array
    {
        $radicacion = $this->route('radicacion');
        $id = ($radicacion instanceof \App\Models\Radicacion) ? $radicacion->id : $radicacion;

        return [
            'tipo' => ['sometimes', 'string', 'max:255', 'unique:radicaciones,tipo,'.$id],
        ];
    }
}
