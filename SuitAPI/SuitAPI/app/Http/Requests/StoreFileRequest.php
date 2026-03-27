<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFileRequest extends FormRequest
{
    private const ALLOWED_EXTENSIONS = 'pdf,doc,docx,xls,xlsx,csv';

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:'.self::ALLOWED_EXTENSIONS],
            'suit_case_id' => ['nullable', 'exists:suit_cases,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.mimes' => 'El archivo debe ser un documento válido (pdf, doc, docx, xls, xlsx, csv).',
        ];
    }
}
