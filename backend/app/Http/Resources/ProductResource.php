<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;

/** @mixin Product */
class ProductResource extends ProductListResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'sku' => $this->sku,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'images' => $this->images->map(fn (ProductImage $image) => [
                'id' => $image->id,
                'url' => $image->url(),
                'alt' => $image->alt ?? $this->name,
            ]),
            'colors' => $this->colors ?? [],
            'sizes' => $this->sizes ?? [],
            'style' => $this->style,
            'stock' => $this->stock,
            'stock_status' => match (true) {
                $this->stock <= 0 => 'out_of_stock',
                $this->stock <= $this->low_stock_threshold => 'low_stock',
                default => 'in_stock',
            },
            'category' => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
                'parent' => $this->category->parent?->only('id', 'name', 'slug'),
            ] : null,
        ];
    }
}
