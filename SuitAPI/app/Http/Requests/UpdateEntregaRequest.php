<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateEntregaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('entrega'));
    }

    public function rules(): array
    {
        return [
            'tipo_pago_id' => ['sometimes', 'exists:tipo_pagos,id'],
            'monto' => ['sometimes', 'numeric', 'min:0'],
            'nota' => ['nullable', 'string'],
        ];
    }
}
