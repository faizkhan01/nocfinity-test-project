<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    /** Same response whether or not the email exists, so the endpoint cannot be used to enumerate accounts. */
    public function sendLink(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);

        Password::broker($this->broker($request))->sendResetLink(['email' => strtolower($request->string('email'))]);

        return response()->json(['message' => 'If an account exists for that email, a reset link has been sent.']);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker($this->broker($request))->reset(
            [...$request->only('password', 'password_confirmation', 'token'), 'email' => strtolower($request->string('email'))],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This password reset link is invalid or has expired.']);
        }

        return response()->json(['message' => 'Your password has been reset. Please sign in.']);
    }

    private function broker(Request $request): string
    {
        return $request->is('api/v1/admin/*') ? 'staff' : 'customers';
    }
}
