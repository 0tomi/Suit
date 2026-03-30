<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAiSettingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'active_provider' => 'nullable|string|in:openai,gemini,anthropic,deepseek',
            'active_model' => 'nullable|string',
            'openai_key' => 'nullable|string',
            'gemini_key' => 'nullable|string',
            'anthropic_key' => 'nullable|string',
            'deepseek_key' => 'nullable|string',
        ];
    }
}
