<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreGastoSuitCaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('case-write', $this->route('suit_case'));
    }

    public function rules(): array
    {
        return [
            'gasto_id' => ['required', 'exists:gastos,id'],
            'monto' => ['required', 'numeric', 'min:0'],
            'client_id' => ['nullable', 'exists:clients,id'],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['exists:clients,id'],
        ];
    }
}
