<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMultimediaRequest extends FormRequest
{
    private const ALLOWED_EXTENSIONS = 'jpg,jpeg,png,webp,gif,mp4,mov,avi,mkv';

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
            'file' => ['required', 'file', 'mimes:'.self::ALLOWED_EXTENSIONS, 'max:204800'], // 200MB max
            'suit_case_id' => ['nullable', 'exists:suit_cases,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.mimes' => 'El archivo debe ser una imagen o video compatible.',
            'file.max' => 'El archivo multimedia no puede superar los 200 MB.',
        ];
    }
}
