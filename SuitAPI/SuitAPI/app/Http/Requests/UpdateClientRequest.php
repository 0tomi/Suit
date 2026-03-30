<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateClientRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['sometimes', 'required', 'string', 'max:255'],
            'identification_number' => ['nullable', 'string', 'max:255', 'unique:personas,identification_number,'.$this->route('client')->persona_id],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'in:person,company'],
            'status' => ['nullable', 'in:active,inactive,debtor'],
            'notes' => ['nullable', 'string'],
            'gender' => ['sometimes', 'required', 'in:M,F,X'],
            'last_updated_at' => ['nullable', 'date'],
        ];
    }
}
