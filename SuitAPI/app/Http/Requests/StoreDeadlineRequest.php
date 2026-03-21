<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDeadlineRequest extends FormRequest
{
    /**
     * Authorization is handled in the controller via policy checks.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Si no se especifica event_id, se crea el evento automáticamente.
            'event_id' => ['nullable', 'exists:events,id'],
            // suit_case_id es necesario solo si no se especifica event_id, para inferir la agenda.
            'suit_case_id' => ['nullable', 'exists:suit_cases,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['required', 'date'],
            'priority' => ['sometimes', 'in:Normal,Urgente'],
            'notify_at' => ['nullable', 'date'],
        ];
    }
}
