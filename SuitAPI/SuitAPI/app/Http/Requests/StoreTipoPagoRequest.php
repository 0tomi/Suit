<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreTipoPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', \App\Models\TipoPago::class);
    }

    public function rules(): array
    {
        return [
            'titulo' => ['required', 'string', 'max:255'],
            'detalles' => ['nullable', 'string'],
        ];
    }
}
