<?php

namespace Tests\Feature\Auth;

use App\Models\Customer;
use App\Models\Staff;
use App\Notifications\QueuedResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_gets_a_token(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane Doe', 'email' => 'JANE@example.com', 'password' => 'Secret@1234', 'password_confirmation' => 'Secret@1234',
        ])->assertCreated()
            ->assertJsonPath('data.user.email', 'jane@example.com')
            ->assertJsonMissingPath('data.user.password')
            ->assertJsonStructure(['data' => ['token', 'expires_at']]);
    }

    public function test_weak_passwords_are_rejected(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane', 'email' => 'jane@example.com', 'password' => 'password', 'password_confirmation' => 'password',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_login_failure_message_does_not_reveal_which_field_was_wrong(): void
    {
        Customer::factory()->create(['email' => 'jane@example.com']);

        $wrongPassword = $this->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Wrong@1234']);
        $unknownEmail = $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'Wrong@1234']);

        $wrongPassword->assertUnprocessable();
        $this->assertSame($wrongPassword->json('message'), $unknownEmail->json('message'));
    }

    public function test_login_is_locked_after_five_failed_attempts(): void
    {
        Customer::factory()->create(['email' => 'jane@example.com']);

        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Wrong@1234'])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Password@123'])
            ->assertStatus(429)->assertJsonPath('code', 'too_many_attempts');
    }

    public function test_route_rate_limits_follow_the_configuration(): void
    {
        config(['shop.rate_limits.auth' => 2]);

        foreach (range(1, 2) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'Wrong@1234'])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'Wrong@1234'])->assertStatus(429);
    }

    public function test_lockout_uses_the_client_ip_forwarded_by_trusted_proxies(): void
    {
        Customer::factory()->create(['email' => 'jane@example.com']);
        config(['app.trusted_proxies' => '*']);

        foreach (range(1, 5) as $_) {
            $this->withHeader('X-Forwarded-For', '198.51.100.7')
                ->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Wrong@1234'])->assertUnprocessable();
        }

        // Same proxy, same client: locked. Another client behind the same proxy: not locked.
        $this->withHeader('X-Forwarded-For', '198.51.100.7')
            ->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Password@123'])->assertStatus(429);
        $this->withHeader('X-Forwarded-For', '203.0.113.9')
            ->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Password@123'])->assertOk();
    }

    public function test_customer_and_staff_tokens_only_work_on_their_own_guard(): void
    {
        $this->seedRoles();
        $customer = $this->actingAsCustomer();
        $this->getJson('/api/v1/admin/auth/me')->assertUnauthorized();

        $this->actingAsStaff('support');
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->getJson('/api/v1/admin/auth/me')->assertOk()->assertJsonPath('data.permissions.0', 'coupons.view');

        $this->postJson('/api/v1/admin/auth/login', ['email' => $customer->email, 'password' => 'Password@123'])->assertUnprocessable();
    }

    public function test_deactivated_staff_cannot_log_in(): void
    {
        Staff::factory()->create(['email' => 'off@shop.test', 'is_active' => false]);

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'off@shop.test', 'password' => 'Password@123'])->assertUnprocessable();
    }

    public function test_password_reset_flow_revokes_existing_tokens(): void
    {
        Notification::fake();
        $customer = Customer::factory()->create(['email' => 'jane@example.com']);
        $customer->createToken('old');

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'jane@example.com'])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($customer, QueuedResetPassword::class, function (QueuedResetPassword $n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'jane@example.com', 'password' => 'NewSecret@123', 'password_confirmation' => 'NewSecret@123',
        ])->assertOk();

        $this->assertSame(0, $customer->tokens()->count());
        $this->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'NewSecret@123'])->assertOk();
    }
}
