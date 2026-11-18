<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Services\ActivityLogger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array<string, mixed> $data @param list<UploadedFile> $images */
    public function create(array $data, array $images): Product
    {
        return DB::transaction(function () use ($data, $images) {
            $product = Product::create([...$data, 'slug' => $this->uniqueSlug($data['name'])]);
            $this->storeImages($product, $images);
            $this->activity->log('product.created', $product, ['sku' => $product->sku]);

            return $product;
        });
    }

    /** @param array<string, mixed> $data @param list<UploadedFile> $images @param list<int> $removeImageIds */
    public function update(Product $product, array $data, array $images, array $removeImageIds): Product
    {
        return DB::transaction(function () use ($product, $data, $images, $removeImageIds) {
            if (isset($data['name']) && $data['name'] !== $product->name) {
                $data['slug'] = $this->uniqueSlug($data['name'], $product->id);
            }

            $product->fill($data);
            $changes = array_keys($product->getDirty());
            $product->save();

            $product->images()->whereIn('id', $removeImageIds)->get()->each(function ($image) {
                Storage::disk('public')->delete($image->path);
                $image->delete();
            });
            $this->storeImages($product, $images);

            $this->activity->log('product.updated', $product, ['fields' => $changes]);

            return $product;
        });
    }

    public function delete(Product $product): void
    {
        $product->delete();
        $this->activity->log('product.deleted', $product, ['sku' => $product->sku]);
    }

    /** @param list<UploadedFile> $images */
    private function storeImages(Product $product, array $images): void
    {
        $position = (int) $product->images()->max('sort_order');

        foreach ($images as $file) {
            $product->images()->create([
                'path' => $file->store('products', 'public'),
                'alt' => $product->name,
                'sort_order' => ++$position,
            ]);
        }
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'product';
        $slug = $base;

        for ($i = 2; Product::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
