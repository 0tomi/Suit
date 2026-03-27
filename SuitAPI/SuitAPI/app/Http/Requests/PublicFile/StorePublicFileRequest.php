<?php

namespace App\Http\Requests\PublicFile;

use Illuminate\Foundation\Http\FormRequest;

class StorePublicFileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // La autorización se maneja en el controlador vía Policies
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
            'file' => [
                'required',
                'file',
                'mimes:txt,pdf,md,xls,xlsx,doc,docx,ppt,pptx,odp,jpg,jpeg,png,zip,rar,7z',
            ],
            'public_file_catalog_id' => ['sometimes', 'nullable', 'exists:public_file_catalogs,id'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'file.mimes' => 'El archivo debe ser un formato válido para estudios jurídicos (txt, pdf, md, excel, word, powerpoint, imágenes o comprimidos).',
            'file.required' => 'Es necesario adjuntar un archivo.',
        ];
    }
}
