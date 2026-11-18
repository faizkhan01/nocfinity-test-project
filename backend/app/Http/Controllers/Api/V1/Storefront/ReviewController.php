<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Product;
use App\Models\ProductReview;
use App\Services\Catalog\ReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    public function __construct(private readonly ReviewService $reviews) {}

    public function index(Request $request, string $slug): AnonymousResourceCollection
    {
        $request->validate(['sort' => ['nullable', Rule::in(['latest', 'highest', 'lowest'])]]);
        $product = Product::active()->where('slug', $slug)->firstOrFail();

        $query = $product->reviews()->where('is_approved', true)->with('customer:id,name');
        match ($request->input('sort', 'latest')) {
            'highest' => $query->orderByDesc('rating'),
            'lowest' => $query->orderBy('rating'),
            default => $query->latest(),
        };

        return ReviewResource::collection($query->orderByDesc('id')->paginate(6)->withQueryString());
    }

    /** Recent high ratings for the home page testimonials. */
    public function featured(): AnonymousResourceCollection
    {
        $reviews = ProductReview::where('is_approved', true)
            ->where('rating', '>=', 4)
            ->with('customer:id,name')
            ->orderByDesc('rating')
            ->latest()
            ->limit(10)
            ->get();

        return ReviewResource::collection($reviews);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['required', 'string', 'min:10', 'max:2000'],
        ]);
        $product = Product::active()->where('slug', $slug)->firstOrFail();

        $review = $this->reviews->create($request->user(), $product, $data['rating'], $data['comment']);

        return (new ReviewResource($review->load('customer:id,name')))->response()->setStatusCode(201);
    }
}
