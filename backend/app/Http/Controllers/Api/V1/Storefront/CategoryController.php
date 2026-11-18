<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\Catalog\CatalogCache;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        // Cached as plain arrays so the stored value is small and safe to unserialize.
        $tree = CatalogCache::remember(CatalogCache::CATEGORIES, fn () => json_decode(CategoryResource::collection(
            Category::active()
                ->whereNull('parent_id')
                ->with(['children' => fn ($q) => $q->active()])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
        )->toJson(), true));

        return response()->json(['data' => $tree]);
    }
}
