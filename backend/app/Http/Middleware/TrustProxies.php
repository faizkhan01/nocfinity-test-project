<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;

/** Reads trusted proxies from config at request time; env() is unavailable once config is cached. */
class TrustProxies extends Middleware
{
    protected function proxies()
    {
        $proxies = (string) config('app.trusted_proxies');

        return $proxies === '*' ? '*' : array_filter(array_map('trim', explode(',', $proxies)));
    }
}
