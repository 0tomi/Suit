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
        return [
            'nombre_lugar' => ['sometimes', 'string', 'max:255'],
        ];
    }
}
