<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDocumentRequest extends FormRequest
{
    private const ALLOWED_EXTENSIONS = 'html,txt,json';

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
            'name' => ['required', 'string'],
            'file' => ['required', 'file', 'mimes:'.self::ALLOWED_EXTENSIONS, 'max:20480'], // 20MB for docs
            'suit_case_id' => ['nullable', 'exists:suit_cases,id'],
            'event_id' => ['nullable', 'exists:events,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.mimes' => 'El archivo debe ser un documento compatible: html, txt o json.',
            'file.max' => 'El archivo no puede superar los 20 MB.',
        ];
    }
}
