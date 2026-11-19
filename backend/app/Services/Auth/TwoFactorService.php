<?php

namespace App\Services\Auth;

use App\Exceptions\ApiException;
use App\Models\Staff;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorService
{
    public const CHALLENGE_TTL_SECONDS = 300;

    public const CHALLENGE_MAX_ATTEMPTS = 5;

    private const RECOVERY_CODE_COUNT = 8;

    public function __construct(private readonly Google2FA $totp) {}

    /** Start setup: store an unconfirmed secret and return what the authenticator app needs. */
    public function provision(Staff $staff): array
    {
        if ($staff->two_factor_confirmed_at) {
            throw new ApiException('Two-factor authentication is already enabled.', 'two_factor_enabled', 409);
        }

        $secret = $this->totp->generateSecretKey(32);
        $staff->forceFill(['two_factor_secret' => $secret, 'two_factor_recovery_codes' => null, 'two_factor_last_step' => null])->save();

        $url = $this->totp->getQRCodeUrl(config('app.name'), $staff->email, $secret);
        $svg = (new Writer(new ImageRenderer(new RendererStyle(200, 1), new SvgImageBackEnd)))->writeString($url);

        return ['secret' => $secret, 'otpauth_url' => $url, 'qr_code' => 'data:image/svg+xml;base64,'.base64_encode($svg)];
    }

    /** @return list<string> plain recovery codes, shown to the user exactly once */
    public function confirm(Staff $staff, string $code): array
    {
        if (! $staff->two_factor_secret || $staff->two_factor_confirmed_at) {
            throw new ApiException('Start two-factor setup first.', 'two_factor_not_pending', 409);
        }

        if (! $this->verifyCode($staff, $code)) {
            throw ValidationException::withMessages(['code' => 'That code is not valid. Check your authenticator app and try again.']);
        }

        $staff->forceFill(['two_factor_confirmed_at' => now()])->save();

        return $this->regenerateRecoveryCodes($staff);
    }

    public function disable(Staff $staff): void
    {
        $staff->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_step' => null,
        ])->save();
    }

    /** @return list<string> */
    public function regenerateRecoveryCodes(Staff $staff): array
    {
        $codes = collect(range(1, self::RECOVERY_CODE_COUNT))
            ->map(fn () => Str::lower(Str::random(5).'-'.Str::random(5)))
            ->all();

        $staff->forceFill(['two_factor_recovery_codes' => array_map(fn ($c) => hash('sha256', $c), $codes)])->save();

        return $codes;
    }

    /** Short-lived, single-use ticket proving the password step passed. */
    public function issueChallenge(Staff $staff): string
    {
        $token = Str::random(64);
        Cache::put($this->challengeKey($token), ['staff_id' => $staff->id, 'attempts' => 0], self::CHALLENGE_TTL_SECONDS);

        return $token;
    }

    public function completeChallenge(string $token, ?string $code, ?string $recoveryCode): Staff
    {
        $key = $this->challengeKey($token);
        $challenge = Cache::get($key);
        $staff = $challenge ? Staff::find($challenge['staff_id']) : null;

        if (! $staff || ! $staff->is_active || ! $staff->two_factor_confirmed_at) {
            Cache::forget($key);
            throw new ApiException('This sign-in attempt has expired. Please sign in again.', 'challenge_expired', 422);
        }

        $valid = $recoveryCode ? $this->useRecoveryCode($staff, $recoveryCode) : $this->verifyCode($staff, (string) $code);

        if (! $valid) {
            $attempts = $challenge['attempts'] + 1;

            if ($attempts >= self::CHALLENGE_MAX_ATTEMPTS) {
                Cache::forget($key);
                throw new ApiException('Too many incorrect codes. Please sign in again.', 'challenge_expired', 422);
            }

            Cache::put($key, ['staff_id' => $staff->id, 'attempts' => $attempts], self::CHALLENGE_TTL_SECONDS);
            throw ValidationException::withMessages([$recoveryCode ? 'recovery_code' : 'code' => 'That code is not valid.']);
        }

        Cache::forget($key);

        return $staff;
    }

    /** Accepts the current code (±1 step for clock drift) but never the same or an older step twice. */
    private function verifyCode(Staff $staff, string $code): bool
    {
        if (! preg_match('/^\d{6}$/', $code = preg_replace('/\s+/', '', $code))) {
            return false;
        }

        // Passing a previous step (0 if none) makes the library return the exact step that matched.
        $step = $this->totp->verifyKeyNewer($staff->two_factor_secret, $code, $staff->two_factor_last_step ?? 0, 1);

        if (! is_int($step)) {
            return false;
        }

        $staff->forceFill(['two_factor_last_step' => $step])->save();

        return true;
    }

    private function useRecoveryCode(Staff $staff, string $code): bool
    {
        $hash = hash('sha256', Str::lower(trim($code)));
        $codes = $staff->two_factor_recovery_codes ?? [];

        foreach ($codes as $i => $stored) {
            if (hash_equals($stored, $hash)) {
                unset($codes[$i]);
                $staff->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

                return true;
            }
        }

        return false;
    }

    private function challengeKey(string $token): string
    {
        return 'admin-2fa-challenge:'.hash('sha256', $token);
    }
}
