<?php

namespace App\Services\Catalog;

use Closure;
use Illuminate\Support\Facades\Cache;

/** Read-heavy catalog data kept in the cache store (Redis) and dropped whenever products or categories change. */
class CatalogCache
{
    public const CATEGORIES = 'catalog:categories';

    public const FACETS = 'catalog:facets';

    private const TTL_SECONDS = 3600;

    public static function remember(string $key, Closure $callback): mixed
    {
        return Cache::remember($key, self::TTL_SECONDS, $callback);
    }

    public static function flush(): void
    {
        Cache::forget(self::CATEGORIES);
        Cache::forget(self::FACETS);
    }
}
