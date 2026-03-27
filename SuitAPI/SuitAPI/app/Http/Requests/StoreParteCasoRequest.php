<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreParteCasoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('suit_case'));
    }

    /**
     * @return array<string, \Illuminate\Validation\Rules\Exists|string>
     */
    public function rules(): array
    {
        return [
            'parte_id' => ['required', Rule::exists('partes', 'id')->whereNull('deleted_at')],
        ];
    }
}
