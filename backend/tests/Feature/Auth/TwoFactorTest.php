<?php

namespace Tests\Feature\Auth;

use App\Models\Staff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    private Google2FA $totp;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
        $this->totp = new Google2FA;
    }

    public function test_staff_can_enable_two_factor_with_password_and_a_valid_code(): void
    {
        $staff = $this->actingAsStaff('support');

        $this->postJson('/api/v1/admin/two-factor', ['password' => 'wrong'])->assertUnprocessable();
        $setup = $this->postJson('/api/v1/admin/two-factor', ['password' => 'Password@123'])
            ->assertOk()->assertJsonStructure(['data' => ['secret', 'otpauth_url', 'qr_code']]);

        $this->postJson('/api/v1/admin/two-factor/confirm', ['code' => '000000'])->assertUnprocessable();
        $this->postJson('/api/v1/admin/two-factor/confirm', ['code' => $this->totp->getCurrentOtp($setup->json('data.secret'))])
            ->assertOk()->assertJsonCount(8, 'data.recovery_codes');

        $this->assertNotNull($staff->fresh()->two_factor_confirmed_at);
        $this->getJson('/api/v1/admin/auth/me')->assertJsonPath('data.two_factor_enabled', true);
    }

    public function test_login_requires_the_code_and_never_issues_a_token_for_the_password_alone(): void
    {
        $secret = $this->staffWithTwoFactor('two@shop.test');

        $login = $this->postJson('/api/v1/admin/auth/login', ['email' => 'two@shop.test', 'password' => 'Password@123'])
            ->assertOk()->assertJsonPath('data.two_factor_required', true)->assertJsonMissingPath('data.token');
        $challenge = $login->json('data.challenge_token');

        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $challenge, 'code' => $this->codeFor($secret, 1)])
            ->assertOk()->assertJsonStructure(['data' => ['token', 'user' => ['permissions']]]);

        // The challenge is single-use.
        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $challenge, 'code' => $this->codeFor($secret, 1)])
            ->assertUnprocessable()->assertJsonPath('code', 'challenge_expired');
    }

    public function test_a_code_cannot_be_replayed(): void
    {
        $secret = $this->staffWithTwoFactor('replay@shop.test');
        $code = $this->codeFor($secret, 1);

        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $this->challenge('replay@shop.test'), 'code' => $code])->assertOk();
        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $this->challenge('replay@shop.test'), 'code' => $code])
            ->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    public function test_the_challenge_is_dropped_after_five_wrong_codes(): void
    {
        $secret = $this->staffWithTwoFactor('brute@shop.test');
        $challenge = $this->challenge('brute@shop.test');

        foreach (range(1, 4) as $_) {
            $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $challenge, 'code' => '000000'])->assertJsonValidationErrors('code');
        }
        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $challenge, 'code' => '000000'])->assertJsonPath('code', 'challenge_expired');
        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $challenge, 'code' => $this->codeFor($secret, 1)])->assertJsonPath('code', 'challenge_expired');
    }

    public function test_recovery_codes_work_once(): void
    {
        $this->staffWithTwoFactor('lost@shop.test', $codes);

        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $this->challenge('lost@shop.test'), 'recovery_code' => $codes[0]])->assertOk();
        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['challenge_token' => $this->challenge('lost@shop.test'), 'recovery_code' => $codes[0]])
            ->assertJsonValidationErrors('recovery_code');
    }

    public function test_disabling_needs_the_password_and_a_super_admin_can_reset_it_for_others(): void
    {
        $this->staffWithTwoFactor('reset@shop.test');
        $staff = Staff::where('email', 'reset@shop.test')->first();
        $staff->createToken('old');

        $this->actingAsStaff(Staff::SUPER_ADMIN);
        $this->putJson("/api/v1/admin/staff/{$staff->id}", [
            'name' => $staff->name, 'email' => $staff->email, 'roles' => $staff->roles->pluck('id'), 'reset_two_factor' => true,
        ])->assertOk()->assertJsonPath('data.two_factor_enabled', false);
        $this->assertSame(0, $staff->tokens()->count(), 'Resetting 2FA signs the account out everywhere');

        $this->actingAs($staff->fresh(), 'admin');
        $this->deleteJson('/api/v1/admin/two-factor', ['password' => 'wrong'])->assertUnprocessable();
    }

    public function test_the_break_glass_command_resets_even_a_super_admin(): void
    {
        $this->staffWithTwoFactor('lost-sa@shop.test');
        $staff = Staff::where('email', 'lost-sa@shop.test')->first();
        $staff->roles()->sync([\App\Models\Role::where('slug', Staff::SUPER_ADMIN)->value('id')]);
        $staff->createToken('stale');

        $this->artisan('app:reset-two-factor', ['email' => 'LOST-SA@shop.test'])->assertSuccessful();

        $this->assertNull($staff->fresh()->two_factor_confirmed_at);
        $this->assertSame(0, $staff->tokens()->count());
        $this->artisan('app:reset-two-factor', ['email' => 'nobody@shop.test'])->assertFailed();
    }

    /** @param list<string>|null $recoveryCodes */
    private function staffWithTwoFactor(string $email, ?array &$recoveryCodes = null): string
    {
        $staff = Staff::factory()->withRole('support')->create(['email' => $email]);
        $secret = $this->totp->generateSecretKey(32);
        $staff->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => array_map(fn ($c) => hash('sha256', $c), $recoveryCodes = ['aaaaa-bbbbb', 'ccccc-ddddd']),
        ])->save();

        return $secret;
    }

    private function challenge(string $email): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/admin/auth/login', ['email' => $email, 'password' => 'Password@123'])->json('data.challenge_token');
    }

    /** Code for the current time step plus an offset, within the ±1 step drift window. */
    private function codeFor(string $secret, int $offset): string
    {
        return $this->totp->oathTotp($secret, $this->totp->getTimestamp() + $offset);
    }
}
