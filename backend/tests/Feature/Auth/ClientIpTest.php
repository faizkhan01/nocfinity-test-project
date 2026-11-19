<?php

namespace Tests\Feature\Auth;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/** Login lockouts are keyed by email + visitor IP, so these assert which IP the API believes. */
class ClientIpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Customer::factory()->create(['email' => 'jane@example.com']);
    }

    public function test_the_bff_visitor_ip_is_used_only_with_the_shared_secret(): void
    {
        config(['app.bff_secret' => 'top-secret']);

        $this->failLoginFiveTimes(['X-BFF-Secret' => 'top-secret', 'X-Client-IP' => '198.51.100.7']);

        $this->login(['X-BFF-Secret' => 'top-secret', 'X-Client-IP' => '198.51.100.7'])->assertStatus(429);
        $this->login(['X-BFF-Secret' => 'top-secret', 'X-Client-IP' => '203.0.113.9'])->assertOk();
    }

    public function test_a_forged_client_ip_without_the_secret_is_ignored(): void
    {
        config(['app.bff_secret' => 'top-secret']);

        $this->failLoginFiveTimes(['X-BFF-Secret' => 'wrong', 'X-Client-IP' => '198.51.100.7']);

        // Rotating the claimed IP does not escape the lockout, because it was never believed.
        $this->login(['X-BFF-Secret' => 'wrong', 'X-Client-IP' => '203.0.113.9'])->assertStatus(429);
    }

    public function test_an_edge_ip_header_is_trusted_only_from_a_trusted_proxy(): void
    {
        config(['app.client_ip_header' => 'X-Real-IP', 'app.trusted_proxies' => '127.0.0.1']);

        $this->failLoginFiveTimes(['X-Real-IP' => '198.51.100.7']);
        $this->login(['X-Real-IP' => '203.0.113.9'])->assertOk();

        config(['app.trusted_proxies' => '10.9.9.9']);
        $this->login(['X-Real-IP' => '198.51.100.7'])->assertOk();
    }

    public function test_a_link_signed_by_the_queue_worker_verifies_behind_the_https_edge(): void
    {
        config(['app.client_ip_header' => 'X-Real-IP', 'app.trusted_proxies' => '10.0.0.0/8']);
        $customer = Customer::factory()->create(['email' => 'new@gmail.com', 'email_verified_at' => null]);

        // The worker has no request, so it signs against APP_URL (https).
        URL::forceRootUrl('https://api.shop.example');
        URL::forceScheme('https');
        $signed = URL::temporarySignedRoute('auth.verification.verify', now()->addHour(), ['id' => $customer->id, 'hash' => sha1('new@gmail.com')]);
        URL::forceRootUrl(null);
        URL::forceScheme(null);
        $this->assertStringStartsWith('https://', $signed);

        // The edge terminates TLS and forwards plain HTTP from a private address.
        $this->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])
            ->withHeaders(['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'api.shop.example', 'X-Forwarded-Port' => '443', 'X-Real-IP' => '203.0.113.5'])
            ->get(str_replace('https://', 'http://', $signed))
            ->assertRedirect(config('app.frontend_url').'/account?verified=1');

        $this->assertTrue($customer->fresh()->hasVerifiedEmail());
    }

    public function test_api_links_keep_the_https_scheme_after_the_visitor_ip_is_pinned(): void
    {
        config(['app.client_ip_header' => 'X-Real-IP', 'app.trusted_proxies' => '10.0.0.0/8']);

        $this->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])
            ->withHeaders(['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'api.shop.example', 'X-Real-IP' => '203.0.113.5'])
            ->getJson('http://localhost/api/v1/products')
            ->assertJsonPath('links.first', 'https://api.shop.example/api/v1/products?page=1');
    }

    /** @param array<string, string> $headers */
    private function failLoginFiveTimes(array $headers): void
    {
        foreach (range(1, 5) as $_) {
            $this->withHeaders($headers)->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Wrong@1234'])->assertUnprocessable();
        }
    }

    /** @param array<string, string> $headers */
    private function login(array $headers)
    {
        return $this->withHeaders($headers)->postJson('/api/v1/auth/login', ['email' => 'jane@example.com', 'password' => 'Password@123']);
    }
}
