<?php

namespace App\Services\Auth;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginService
{
    public const MAX_ATTEMPTS = 5;

    public const LOCKOUT_SECONDS = 300;

    private const DUMMY_HASH = '$2y$12$AaaTyhQbjSNPSt5LBnpuaeRbRAJJllBZ6W246rBS40u6zAnWpFXWW';

    /**
     * Verify credentials against the given user query (customers or staff) with throttling.
     *
     * @template T of User
     *
     * @param  Builder<T>  $users
     * @return T
     */
    public function attempt(Builder $users, string $email, string $password, Request $request, string $scope): User
    {
        $key = $this->throttleKey($scope, $email, $request);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);

            throw new ApiException(
                "Too many login attempts. Please try again in {$seconds} seconds.",
                'too_many_attempts',
                429,
            );
        }

        $user = (clone $users)->where('email', Str::lower($email))->first();

        // Hash even for unknown emails so response time does not reveal which accounts exist.
        $valid = Hash::check($password, $user?->password ?? self::DUMMY_HASH);

        if (! $user || ! $valid || ! $user->is_active) {
            RateLimiter::hit($key, self::LOCKOUT_SECONDS);

            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        RateLimiter::clear($key);

        return $user;
    }

    /** @return array{token: string, expires_at: string|null} */
    public function issueToken(User $user, string $ability, Request $request): array
    {
        $minutes = (int) config('sanctum.expiration');
        $expiresAt = $minutes > 0 ? now()->addMinutes($minutes) : null;

        $token = $user->createToken(
            Str::limit((string) $request->userAgent(), 100, '') ?: 'api',
            [$ability],
            $expiresAt,
        );

        $user->forceFill(['last_login_at' => now()])->save();

        return ['token' => $token->plainTextToken, 'expires_at' => $expiresAt?->toIso8601String()];
    }

    private function throttleKey(string $scope, string $email, Request $request): string
    {
        return 'login:'.$scope.':'.Str::transliterate(Str::lower($email)).'|'.$request->ip();
    }
}
