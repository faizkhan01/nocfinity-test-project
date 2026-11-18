<?php

namespace App\Http\Resources;

use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProductReview */
class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'author' => $this->customer?->name,
            'verified_buyer' => true,
            'product' => $this->whenLoaded('product', fn () => $this->product->only('id', 'name', 'slug')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
