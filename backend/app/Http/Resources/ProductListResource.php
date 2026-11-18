<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'price_cents' => $this->price_cents,
            'discount_price_cents' => $this->discount_price_cents,
            'final_price_cents' => $this->unitPriceCents(),
            'discount_percent' => $this->discountPercent(),
            'image' => $this->primaryImage?->url(),
            'rating_avg' => round($this->rating_avg, 1),
            'rating_count' => $this->rating_count,
            'in_stock' => $this->stock > 0,
            'category' => $this->whenLoaded('category', fn () => $this->category->only('id', 'name', 'slug')),
        ];
    }
}
