<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

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
