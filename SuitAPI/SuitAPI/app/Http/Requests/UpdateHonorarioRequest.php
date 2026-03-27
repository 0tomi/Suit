<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateHonorarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('case-write', $this->route('honorario'));
    }

    public function rules(): array
    {
        return [
            'monto' => ['sometimes', 'numeric', 'min:0'],
            'detalles' => ['nullable', 'string'],
        ];
    }
}
