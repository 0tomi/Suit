<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreHonorarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('case-write', $this->route('suit_case'));
    }

    public function rules(): array
    {
        return [
            'client_id' => ['required', 'exists:clients,id'],
            'monto' => ['required', 'numeric', 'min:0'],
            'detalles' => ['nullable', 'string'],
        ];
    }
}
