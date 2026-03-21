<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateGastoSuitCaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('case-write', $this->route('gasto_suit_case'));
    }

    public function rules(): array
    {
        return [
            'monto' => ['sometimes', 'numeric', 'min:0'],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['exists:clients,id'],
        ];
    }
}
