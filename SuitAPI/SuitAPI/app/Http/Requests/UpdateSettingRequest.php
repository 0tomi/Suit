<?php

namespace App\Http\Requests;

use App\Models\Deadline;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La autorización real se delega a la Policy en el Controller.
        return true;
    }

    /**
     * Reglas de validación contextuales según la clave de la setting.
     *
     * Claves con dominio numérico (e.g. deadline_urgency_days) requieren
     * un entero >= 0 para evitar corrupciones de datos silenciosas.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $key = $this->route('key');

        $numericIntegerKeys = [
            Deadline::SETTING_URGENCY_DAYS,
        ];

        if (in_array($key, $numericIntegerKeys, true)) {
            return [
                'value' => ['required', 'string', 'regex:/^\d+$/', 'max:10'],
            ];
        }

        return [
            'value' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'value.regex' => 'El valor debe ser un número entero positivo.',
        ];
    }
}
