<?php

namespace App\Models;

use App\Services\Catalog\CatalogCache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Scout\Searchable;

class Product extends Model
{
    use HasFactory, Searchable, SoftDeletes;

    /** Fields that feed the search index; changes to anything else (e.g. stock) skip re-indexing. */
    private const SEARCH_FIELDS = ['name', 'sku', 'short_description', 'description', 'category_id', 'colors', 'style', 'is_active'];

    /** Fields shown in the cached filter facets. */
    private const FACET_FIELDS = ['colors', 'sizes', 'style', 'price_cents', 'discount_price_cents', 'is_active', 'category_id'];

    protected $fillable = [
        'category_id', 'name', 'slug', 'sku', 'short_description', 'description',
        'price_cents', 'discount_price_cents', 'stock', 'low_stock_threshold',
        'colors', 'sizes', 'style', 'is_active', 'is_featured',
    ];

    protected function casts(): array
    {
        return [
            'category_id' => 'integer',
            'price_cents' => 'integer',
            'discount_price_cents' => 'integer',
            'effective_price_cents' => 'integer',
            'stock' => 'integer',
            'low_stock_threshold' => 'integer',
            'colors' => 'array',
            'sizes' => 'array',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'rating_avg' => 'float',
            'rating_count' => 'integer',
            'sold_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::created(fn () => CatalogCache::flush());
        static::updated(fn (self $product) => $product->wasChanged([...self::FACET_FIELDS, ...self::SEARCH_FIELDS]) && CatalogCache::flush());
        static::deleted(fn () => CatalogCache::flush());
        static::restored(fn () => CatalogCache::flush());
    }

    public function searchableAs(): string
    {
        return 'products';
    }

    /** Inactive or deleted products never enter the index; MySQL filters remain the source of truth anyway. */
    public function shouldBeSearchable(): bool
    {
        return $this->is_active && ! $this->trashed();
    }

    public function searchIndexShouldBeUpdated(): bool
    {
        // A fresh insert has no recorded changes; later saves on the same instance do.
        return ($this->wasRecentlyCreated && $this->getChanges() === []) || $this->wasChanged(self::SEARCH_FIELDS);
    }

    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'sku' => $this->sku,
            'category' => $this->category?->name,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'colors' => array_column($this->colors ?? [], 'name'),
            'style' => $this->style,
        ];
    }

    protected function makeAllSearchableUsing(Builder $query): Builder
    {
        return $query->with('category');
    }

    /** Queued indexing jobs rebuild models without relations; load the one the document needs. */
    public function makeSearchableUsing(EloquentCollection $models): EloquentCollection
    {
        return $models->loadMissing('category');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function primaryImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('products.is_active', true);
    }

    /** Price the customer actually pays; the generated column is not refreshed on unsaved models. */
    public function unitPriceCents(): int
    {
        return $this->discount_price_cents ?? $this->price_cents;
    }

    public function isPurchasable(): bool
    {
        return $this->is_active && ! $this->trashed() && $this->stock > 0;
    }

    public function discountPercent(): ?int
    {
        if ($this->discount_price_cents === null || $this->price_cents === 0) {
            return null;
        }

        return (int) round(100 - ($this->discount_price_cents / $this->price_cents * 100));
    }

    public function hasColor(?string $color): bool
    {
        return in_array($color, array_column($this->colors ?? [], 'name'), true);
    }

    public function hasSize(?string $size): bool
    {
        return in_array($size, $this->sizes ?? [], true);
    }
}
