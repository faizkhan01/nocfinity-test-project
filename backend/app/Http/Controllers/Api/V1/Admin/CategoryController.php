<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CategoryRequest;
use App\Models\Category;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function __construct(private readonly ActivityLogger $activity) {}

    public function index(): JsonResponse
    {
        $tree = Category::whereNull('parent_id')
            ->withCount('products')
            ->with(['children' => fn ($q) => $q->withCount('products')])
            ->orderBy('sort_order')->orderBy('name')
            ->get();

        return response()->json(['data' => $tree->map(fn (Category $c) => $this->present($c, true))]);
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $data = $request->safe()->except('image');
        $category = Category::create([
            ...$data,
            'slug' => $this->uniqueSlug($data['name']),
            'sort_order' => $data['sort_order'] ?? 0,
            'image_path' => $request->file('image')?->store('categories', 'public'),
        ]);
        $this->activity->log('category.created', $category);

        return response()->json(['data' => $this->present($category->loadCount('products'))], 201);
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        $data = $request->safe()->except('image');

        if ($data['name'] !== $category->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $category->id);
        }

        if ($request->hasFile('image')) {
            $category->image_path && Storage::disk('public')->delete($category->image_path);
            $data['image_path'] = $request->file('image')->store('categories', 'public');
        }

        $category->update($data);
        $this->activity->log('category.updated', $category);

        return response()->json(['data' => $this->present($category->loadCount('products'))]);
    }

    public function destroy(Category $category): Response
    {
        if ($category->children()->exists()) {
            throw new ApiException('Delete or move the subcategories first.', 'category_has_children', 409);
        }

        if ($category->products()->withTrashed()->exists()) {
            throw new ApiException('This category still has products. Move them or deactivate the category instead.', 'category_has_products', 409);
        }

        $category->image_path && Storage::disk('public')->delete($category->image_path);
        $category->delete();
        $this->activity->log('category.deleted', null, ['category' => $category->only('id', 'name')]);

        return response()->noContent();
    }

    private function present(Category $category, bool $withChildren = false): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'image' => $category->imageUrl(),
            'parent_id' => $category->parent_id,
            'is_active' => $category->is_active,
            'sort_order' => $category->sort_order,
            'products_count' => $category->products_count ?? 0,
            'children' => $withChildren ? $category->children->map(fn (Category $c) => $this->present($c)) : [],
        ];
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;

        for ($i = 2; Category::where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
