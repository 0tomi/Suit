<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserByTagRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $userToUpdate = $this->route('user');

        return $this->user()->can('update', $userToUpdate);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $userToUpdate = $this->route('user');
        $isAdmin = $this->user()->role === 'admin';

        $rules = [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email,'.($userToUpdate ? $userToUpdate->id : 'NULL')],
            'password' => ['sometimes', 'required', 'string', 'min:8'],
        ];

        if ($isAdmin) {
            $rules['tag'] = ['sometimes', 'required', 'string', 'max:255', 'unique:users,tag,'.($userToUpdate ? $userToUpdate->id : 'NULL')];
            $rules['role'] = ['sometimes', 'required', 'string', 'in:user,lawyer,admin'];
        }

        return $rules;
    }
}
