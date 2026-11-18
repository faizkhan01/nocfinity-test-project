<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdatePasswordRequest extends FormRequest
{
    public function rules(): array
    {
        $guard = $this->is('api/v1/admin/*') ? 'admin' : 'customer';

        return [
            'current_password' => ['required', 'string', 'current_password:'.$guard],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', Password::defaults()],
        ];
    }
}
