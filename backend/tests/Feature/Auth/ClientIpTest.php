<?php

namespace Tests\Feature\Auth;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
