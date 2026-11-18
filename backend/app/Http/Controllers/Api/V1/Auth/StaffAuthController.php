<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\StaffResource;
use App\Models\Staff;
use App\Services\Auth\LoginService;
use App\Services\Auth\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StaffAuthController extends Controller
{
    public function __construct(
        private readonly LoginService $login,
        private readonly TwoFactorService $twoFactor,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $staff = $this->login->attempt(
            Staff::query(), $request->string('email'), $request->string('password'), $request, 'staff',
        );

        // With 2FA on, a correct password only earns a short-lived challenge, never a token.
        if ($staff->two_factor_confirmed_at) {
            return response()->json(['data' => [
                'two_factor_required' => true,
                'challenge_token' => $this->twoFactor->issueChallenge($staff),
                'expires_in' => TwoFactorService::CHALLENGE_TTL_SECONDS,
            ]]);
        }

        return $this->authenticated($staff, $request);
    }

    public function twoFactorChallenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string', 'size:64'],
            'code' => ['nullable', 'required_without:recovery_code', 'string', 'max:10'],
            'recovery_code' => ['nullable', 'string', 'max:20'],
        ]);

        $staff = $this->twoFactor->completeChallenge($data['challenge_token'], $data['code'] ?? null, $data['recovery_code'] ?? null);

        return $this->authenticated($staff, $request);
    }

    private function authenticated(Staff $staff, Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                ...$this->login->issueToken($staff, 'admin', $request),
                'user' => new StaffResource($staff->load('roles')),
            ],
        ]);
    }

    public function me(Request $request): StaffResource
    {
        return new StaffResource($request->user()->load('roles'));
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
