<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pins $request->ip() to the real visitor so per-IP rate limits and lockouts work behind the
 * Next.js BFF and platform edges. Runs after TrustProxies.
 */
class ResolveClientIp
{
    public function handle(Request $request, Closure $next): Response
    {
        $ip = $this->fromBff($request) ?? $this->fromEdgeHeader($request);

        if ($ip !== null) {
            // With the forwarding headers removed, ip() falls back to this address.
            $request->server->set('REMOTE_ADDR', $ip);
            $request->headers->remove('X-Forwarded-For');
        }

        $request->headers->remove('X-BFF-Secret');

        return $next($request);
    }

    /** The BFF forwards the browser's address, which is only believed with the shared secret. */
    private function fromBff(Request $request): ?string
    {
        $secret = (string) config('app.bff_secret');
        $given = (string) $request->header('X-BFF-Secret');

        if ($secret === '' || ! hash_equals($secret, $given)) {
            return null;
        }

        return $this->validIp($request->header('X-Client-IP'));
    }

    /** A header the platform edge overwrites (e.g. Railway's X-Real-IP), trusted only from a known proxy. */
    private function fromEdgeHeader(Request $request): ?string
    {
        $header = (string) config('app.client_ip_header');
        $proxies = (string) config('app.trusted_proxies');

        if ($header === '' || $proxies === '' || $proxies === '*') {
            return null;
        }

        $remote = (string) $request->server('REMOTE_ADDR');

        if (! IpUtils::checkIp($remote, array_map('trim', explode(',', $proxies)))) {
            return null;
        }

        return $this->validIp($request->header($header));
    }

    private function validIp(?string $value): ?string
    {
        $value = trim((string) $value);

        return filter_var($value, FILTER_VALIDATE_IP) ? $value : null;
    }
}
