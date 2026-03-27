<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDeadlineRequest extends FormRequest
{
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
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'priority' => ['sometimes', 'in:Normal,Urgente'],
            'due_date' => ['sometimes', 'date'],
            'status' => ['sometimes', 'in:Pendiente,Vencido,Prorrogado,Cumplido'],
            'notify_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
