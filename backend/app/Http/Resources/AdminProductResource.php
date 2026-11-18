<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class AdminProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'category' => $this->whenLoaded('category', fn () => $this->category?->only('id', 'name', 'parent_id')),
            'category_id' => $this->category_id,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'price_cents' => $this->price_cents,
            'discount_price_cents' => $this->discount_price_cents,
            'stock' => $this->stock,
            'low_stock_threshold' => $this->low_stock_threshold,
            'is_low_stock' => $this->stock <= $this->low_stock_threshold,
            'colors' => $this->colors ?? [],
            'sizes' => $this->sizes ?? [],
            'style' => $this->style,
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'rating_avg' => round($this->rating_avg, 1),
            'sold_count' => $this->sold_count,
            'image' => $this->whenLoaded('primaryImage', fn () => $this->primaryImage?->url()),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn (ProductImage $i) => ['id' => $i->id, 'url' => $i->url()])),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
