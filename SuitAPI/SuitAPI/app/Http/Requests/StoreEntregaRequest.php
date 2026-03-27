<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreEntregaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', \App\Models\Entrega::class);
    }

    public function rules(): array
    {
        return [
            'tipo_pago_id' => ['required', 'exists:tipo_pagos,id'],
            'monto' => ['required', 'numeric', 'min:0'],
            'nota' => ['nullable', 'string'],
        ];
    }
}
