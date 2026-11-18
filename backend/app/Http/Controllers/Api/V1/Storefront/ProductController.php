<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ProductIndexRequest;
use App\Http\Resources\ProductListResource;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\Catalog\ProductSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function __construct(private readonly ProductSearch $search) {}

    public function index(ProductIndexRequest $request): AnonymousResourceCollection
    {
        return ProductListResource::collection($this->search->paginate($request->validated()));
    }

    public function filters(): JsonResponse
    {
        return response()->json(['data' => $this->search->facets()]);
    }

    public function show(string $slug): ProductResource
    {
        return new ProductResource($this->findActive($slug)->load(['images', 'category.parent']));
    }

    public function related(string $slug): AnonymousResourceCollection
    {
        $product = $this->findActive($slug);

        $related = Product::active()
            ->where('category_id', $product->category_id)
            ->whereKeyNot($product->id)
            ->with(['primaryImage', 'category:id,name,slug'])
            ->orderByDesc('sold_count')
            ->limit(4)
            ->get();

        return ProductListResource::collection($related);
    }

    private function findActive(string $slug): Product
    {
        return Product::active()
            ->whereHas('category', fn ($q) => $q->active())
            ->where('slug', $slug)
            ->firstOrFail();
    }
}
