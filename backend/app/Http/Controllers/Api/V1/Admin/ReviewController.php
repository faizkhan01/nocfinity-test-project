<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductReview;
use App\Services\ActivityLogger;
use App\Services\Catalog\ReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function __construct(
        private readonly ReviewService $reviews,
        private readonly ActivityLogger $activity,
    ) {}

    public function index(): JsonResponse
    {
        $reviews = ProductReview::with(['customer:id,name,email', 'product:id,name,slug'])->latest('id')->paginate(20);

        return response()->json([
            'data' => $reviews->getCollection()->map(fn (ProductReview $r) => [
                ...$r->only('id', 'rating', 'comment', 'is_approved'),
                'customer' => $r->customer?->only('id', 'name', 'email'),
                'product' => $r->product?->only('id', 'name', 'slug'),
                'created_at' => $r->created_at?->toIso8601String(),
            ]),
            'meta' => ['current_page' => $reviews->currentPage(), 'last_page' => $reviews->lastPage(), 'total' => $reviews->total()],
        ]);
    }

    public function update(Request $request, ProductReview $review): JsonResponse
    {
        $data = $request->validate(['is_approved' => ['required', 'boolean']]);
        $review->update($data);
        $this->reviews->refreshRating($review->product);
        $this->activity->log('review.moderated', $review->product, ['review_id' => $review->id, ...$data]);

        return response()->json(['data' => $review->only('id', 'is_approved')]);
    }

    public function destroy(ProductReview $review): Response
    {
        $product = $review->product;
        $review->delete();
        $this->reviews->refreshRating($product);
        $this->activity->log('review.deleted', $product, ['review_id' => $review->id]);

        return response()->noContent();
    }
}
