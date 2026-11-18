<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductRequest;
use App\Http\Resources\AdminProductResource;
use App\Models\Category;
use App\Models\Product;
use App\Services\ActivityLogger;
use App\Services\Catalog\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'stock' => ['nullable', Rule::in(['low', 'out'])],
            'sort' => ['nullable', Rule::in(['newest', 'name', 'price', 'stock'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = ['newest' => ['id', 'desc'], 'name' => ['name', 'asc'], 'price' => ['price_cents', 'asc'], 'stock' => ['stock', 'asc']];
        [$column, $direction] = $sort[$request->input('sort', 'newest')];

        $products = Product::with(['category:id,name,parent_id', 'primaryImage'])
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.addcslashes((string) $request->string('search'), '%_\\').'%';
                $q->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('sku', 'like', $term));
            })
            ->when($request->filled('category_id'), function ($q) use ($request) {
                $category = Category::find($request->integer('category_id'));
                $q->whereIn('category_id', $category?->selfAndChildIds() ?? [0]);
            })
            ->when($request->input('status') === 'active', fn ($q) => $q->where('is_active', true))
            ->when($request->input('status') === 'inactive', fn ($q) => $q->where('is_active', false))
            ->when($request->input('stock') === 'low', fn ($q) => $q->whereColumn('stock', '<=', 'low_stock_threshold')->where('stock', '>', 0))
            ->when($request->input('stock') === 'out', fn ($q) => $q->where('stock', 0))
            ->orderBy($column, $direction)
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return AdminProductResource::collection($products);
    }

    public function show(Product $product): AdminProductResource
    {
        return new AdminProductResource($product->load(['category:id,name,parent_id', 'images', 'primaryImage']));
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $product = $this->products->create($request->productData(), $request->file('images', []));

        return (new AdminProductResource($product->load(['category:id,name,parent_id', 'images', 'primaryImage'])))
            ->response()->setStatusCode(201);
    }

    public function update(ProductRequest $request, Product $product): AdminProductResource
    {
        $product = $this->products->update(
            $product, $request->productData(), $request->file('images', []), array_map('intval', $request->input('remove_image_ids', [])),
        );

        return new AdminProductResource($product->load(['category:id,name,parent_id', 'images', 'primaryImage']));
    }

    public function toggle(Request $request, Product $product, ActivityLogger $activity): AdminProductResource
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $product->update($data);
        $activity->log('product.status_changed', $product, $data);

        return new AdminProductResource($product->load(['category:id,name,parent_id', 'primaryImage']));
    }

    public function destroy(Product $product): Response
    {
        $this->products->delete($product);

        return response()->noContent();
    }
}
