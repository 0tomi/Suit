<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class StoreRadicacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', \App\Models\Radicacion::class);
    }

    public function rules(): array
    {
        return [
            'nombre_lugar' => ['required', 'string', 'max:255'],
        ];
    }
}
