<?php

namespace App\Services\Catalog;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProductSearch
{
    /** Whitelisted sorts: key => [column, direction]; "relevance" follows the search engine's ranking. */
    public const SORTS = [
        'relevance' => [null, null],
        'newest' => ['created_at', 'desc'],
        'price_asc' => ['effective_price_cents', 'asc'],
        'price_desc' => ['effective_price_cents', 'desc'],
        'popular' => ['sold_count', 'desc'],
        'rating' => ['rating_avg', 'desc'],
    ];

    private const MAX_SEARCH_HITS = 500;

    /** Scout drivers that only do exact word matching; the built-in matcher replaces them. */
    private const BUILT_IN_DRIVERS = ['database', 'collection', 'null'];

    public const SIZE_ORDER = ['XX-Small', 'X-Small', 'Small', 'Medium', 'Large', 'X-Large', 'XX-Large', '3X-Large', '4X-Large'];

    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $hits = ! empty($filters['search']) ? $this->searchIds($filters['search']) : null;
        $sort = $filters['sort'] ?? ($hits !== null ? 'relevance' : 'newest');
        $query = $this->query($filters, $hits)->with(['primaryImage', 'category:id,name,slug']);

        if ($sort === 'relevance' && $hits) {
            // Ids come from the engine as integers, so inlining them into FIELD() is safe.
            $query->orderByRaw('FIELD(products.id, '.implode(',', array_map('intval', $hits)).')');
        } else {
            [$column, $direction] = self::SORTS[$sort === 'relevance' ? 'newest' : $sort];
            $query->orderBy($column, $direction);
        }

        return $query->orderBy('id', 'desc')
            ->paginate((int) ($filters['per_page'] ?? 9))
            ->withQueryString();
    }

    public function __construct(private readonly ProductMatcher $matcher) {}

    /**
     * Matching product ids in relevance order: from Meilisearch (or another external engine) when one is
     * configured, otherwise from the built-in forgiving matcher, which is also the fallback if the engine is down.
     *
     * @return list<int>
     */
    public function searchIds(string $search): array
    {
        // An exact SKU is a lookup, not a fuzzy search ("SC-0009" would otherwise match every "SC-" SKU).
        if (preg_match('/^[a-z0-9]+(-[a-z0-9]+)+$/i', trim($search))) {
            $id = Product::active()->where('sku', strtoupper(trim($search)))->value('id');

            if ($id) {
                return [(int) $id];
            }
        }

        if (in_array(config('scout.driver'), self::BUILT_IN_DRIVERS, true)) {
            return $this->matcher->search($search, self::MAX_SEARCH_HITS);
        }

        try {
            return Product::search($search)->take(self::MAX_SEARCH_HITS)->keys()->map(fn ($id) => (int) $id)->values()->all();
        } catch (Throwable $e) {
            Log::warning('Product search engine unavailable, using the built-in matcher', ['error' => $e->getMessage()]);

            return $this->matcher->search($search, self::MAX_SEARCH_HITS);
        }
    }

    /** @param array<string, mixed> $filters @param list<int>|null $hits ids from the search engine */
    public function query(array $filters, ?array $hits = null): Builder
    {
        return Product::query()
            ->active()
            ->whereHas('category', fn (Builder $q) => $q->active())
            ->when($hits !== null, fn (Builder $q) => $q->whereIn('products.id', $hits ?: [0]))
            ->when($filters['category'] ?? null, function (Builder $q, string $slug) {
                $category = Category::active()->where('slug', $slug)->first();
                $q->whereIn('category_id', $category?->selfAndChildIds() ?? [0]);
            })
            ->when(isset($filters['min_price']), fn (Builder $q) => $q->where('effective_price_cents', '>=', (int) $filters['min_price']))
            ->when(isset($filters['max_price']), fn (Builder $q) => $q->where('effective_price_cents', '<=', (int) $filters['max_price']))
            ->when($filters['colors'] ?? null, fn (Builder $q, array $colors) => $q->where(function (Builder $q) use ($colors) {
                foreach ($colors as $color) {
                    $q->orWhereJsonContains('colors', ['name' => $color]);
                }
            }))
            ->when($filters['sizes'] ?? null, fn (Builder $q, array $sizes) => $q->where(function (Builder $q) use ($sizes) {
                foreach ($sizes as $size) {
                    $q->orWhereJsonContains('sizes', $size);
                }
            }))
            ->when($filters['styles'] ?? null, fn (Builder $q, array $styles) => $q->whereIn('style', $styles))
            ->when(filter_var($filters['in_stock'] ?? false, FILTER_VALIDATE_BOOL), fn (Builder $q) => $q->where('stock', '>', 0))
            ->when(filter_var($filters['featured'] ?? false, FILTER_VALIDATE_BOOL), fn (Builder $q) => $q->where('is_featured', true))
            ->when(filter_var($filters['on_sale'] ?? false, FILTER_VALIDATE_BOOL), fn (Builder $q) => $q->whereNotNull('discount_price_cents'));
    }

    /** Values the filter sidebar can offer, computed from the active catalog. */
    public function facets(): array
    {
        return CatalogCache::remember(CatalogCache::FACETS, fn () => $this->computeFacets());
    }

    private function computeFacets(): array
    {
        $products = Product::active()->get(['colors', 'sizes', 'style', 'effective_price_cents']);

        $order = array_flip(config('shop.color_order', []));
        $colors = $products->flatMap(fn (Product $p) => $p->colors ?? [])->unique('name')
            ->sortBy(fn (array $c) => [$order[$c['name']] ?? PHP_INT_MAX, $c['name']])->values();
        $sizes = $products->flatMap(fn (Product $p) => $p->sizes ?? [])->unique()->values();

        return [
            'colors' => $colors,
            'sizes' => collect(self::SIZE_ORDER)->intersect($sizes)->merge($sizes->diff(self::SIZE_ORDER))->values(),
            'styles' => $products->pluck('style')->filter()->unique()->sort()->values(),
            'price' => [
                'min_cents' => (int) $products->min('effective_price_cents'),
                'max_cents' => (int) $products->max('effective_price_cents'),
            ],
        ];
    }
}
