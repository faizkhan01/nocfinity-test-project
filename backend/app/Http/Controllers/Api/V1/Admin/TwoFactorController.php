<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\Auth\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Self-service 2FA for the signed-in staff member; changes that weaken security require the password again. */
class TwoFactorController extends Controller
{
    public function __construct(
        private readonly TwoFactorService $twoFactor,
        private readonly ActivityLogger $activity,
    ) {}

    public function enable(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string', 'current_password:admin']]);

        return response()->json(['data' => $this->twoFactor->provision($request->user())]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $codes = $this->twoFactor->confirm($request->user(), $data['code']);
        $this->activity->log('two_factor.enabled', $request->user());

        return response()->json(['data' => ['recovery_codes' => $codes]]);
    }

    public function recoveryCodes(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string', 'current_password:admin']]);
        abort_unless($request->user()->two_factor_confirmed_at, 409, 'Two-factor authentication is not enabled.');

        $codes = $this->twoFactor->regenerateRecoveryCodes($request->user());
        $this->activity->log('two_factor.recovery_codes_regenerated', $request->user());

        return response()->json(['data' => ['recovery_codes' => $codes]]);
    }

    public function disable(Request $request): Response
    {
        $request->validate(['password' => ['required', 'string', 'current_password:admin']]);
        $this->twoFactor->disable($request->user());
        $this->activity->log('two_factor.disabled', $request->user());

        return response()->noContent();
    }
}
