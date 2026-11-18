<?php

namespace App\Services\Catalog;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ProductSearch
{
    /** Whitelisted sorts: key => [column, direction]. */
    public const SORTS = [
        'newest' => ['created_at', 'desc'],
        'price_asc' => ['effective_price_cents', 'asc'],
        'price_desc' => ['effective_price_cents', 'desc'],
        'popular' => ['sold_count', 'desc'],
        'rating' => ['rating_avg', 'desc'],
    ];

    public const SIZE_ORDER = ['XX-Small', 'X-Small', 'Small', 'Medium', 'Large', 'X-Large', 'XX-Large', '3X-Large', '4X-Large'];

    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator
    {
        [$column, $direction] = self::SORTS[$filters['sort'] ?? 'newest'];

        return $this->query($filters)
            ->with(['primaryImage', 'category:id,name,slug'])
            ->orderBy($column, $direction)
            ->orderBy('id', 'desc')
            ->paginate((int) ($filters['per_page'] ?? 9))
            ->withQueryString();
    }

    /** @param array<string, mixed> $filters */
    public function query(array $filters): Builder
    {
        return Product::query()
            ->active()
            ->whereHas('category', fn (Builder $q) => $q->active())
            ->when($filters['search'] ?? null, function (Builder $q, string $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn (Builder $q) => $q->where('name', 'like', $term)
                    ->orWhere('short_description', 'like', $term)
                    ->orWhere('sku', 'like', $term));
            })
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
