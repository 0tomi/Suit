<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateGastoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('gasto'));
    }

    public function rules(): array
    {
        return [
            'titulo' => ['sometimes', 'string', 'max:255'],
            'detalles' => ['nullable', 'string'],
        ];
    }
}
