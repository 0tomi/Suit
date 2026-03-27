<?php

namespace App\Http\Requests;

use App\Enums\DocumentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentRequest extends FormRequest
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
            'name' => ['required', 'string'],
            'content' => ['required', 'string'],
            'suit_case_id' => ['nullable', 'exists:suit_cases,id'],
            'event_id' => ['nullable', 'exists:events,id'],
            'status' => ['nullable', Rule::enum(DocumentStatus::class)],
        ];
    }
}
