<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTemplateRequest extends FormRequest
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
            'template_category_id' => ['nullable', 'exists:template_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'requirements' => ['nullable', 'array'],
            'requirements.*.id_requisito' => ['required', 'exists:requisitos,id'],
            'requirements.*.id_campo' => ['required', 'integer'],
            'requirements.*.NEntidad' => ['required', 'integer'],
            'requirements.*.note' => ['nullable', 'string'],
        ];
    }
}
