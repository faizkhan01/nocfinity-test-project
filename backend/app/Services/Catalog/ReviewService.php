<?php

namespace App\Services\Catalog;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductReview;
use Illuminate\Support\Facades\DB;

class ReviewService
{
    /** Only customers with a delivered order for the product may review it, once. */
    public function create(Customer $customer, Product $product, int $rating, string $comment): ProductReview
    {
        $purchased = $customer->orders()
            ->where('status', OrderStatus::Delivered)
            ->whereHas('items', fn ($q) => $q->where('product_id', $product->id))
            ->exists();

        if (! $purchased) {
            throw new ApiException('You can review a product after your order for it is delivered.', 'review_not_allowed', 403);
        }

        if ($product->reviews()->where('user_id', $customer->id)->exists()) {
            throw new ApiException('You have already reviewed this product.', 'review_exists', 409);
        }

        return DB::transaction(function () use ($customer, $product, $rating, $comment) {
            $review = $product->reviews()->create(['user_id' => $customer->id, 'rating' => $rating, 'comment' => $comment]);
            $this->refreshRating($product);

            return $review;
        });
    }

    public function refreshRating(Product $product): void
    {
        $stats = $product->reviews()->where('is_approved', true)
            ->selectRaw('count(*) as total, coalesce(avg(rating), 0) as average')
            ->first();

        $product->forceFill([
            'rating_count' => (int) $stats->total,
            'rating_avg' => round((float) $stats->average, 2),
        ])->saveQuietly();
    }
}
