<?php

namespace App\Services\Catalog;

use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\ActivityLogger;
use App\Services\Media\MediaStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class ProductService
{
    public function __construct(private readonly ActivityLogger $activity, private readonly MediaStorage $media) {}

    /** @param array<string, mixed> $data @param list<UploadedFile> $images */
    public function create(array $data, array $images): Product
    {
        return $this->withUploads(fn (array &$stored) => DB::transaction(function () use ($data, $images, &$stored) {
            $product = Product::create([...$data, 'slug' => $this->uniqueSlug($data['name'])]);
            $this->storeImages($product, $images, $stored);
            $this->activity->log('product.created', $product, ['sku' => $product->sku]);

            return $product;
        }));
    }

    /** @param array<string, mixed> $data @param list<UploadedFile> $images @param list<int> $removeImageIds */
    public function update(Product $product, array $data, array $images, array $removeImageIds): Product
    {
        return $this->withUploads(fn (array &$stored) => DB::transaction(function () use ($product, $data, $images, $removeImageIds, &$stored) {
            if (isset($data['name']) && $data['name'] !== $product->name) {
                $data['slug'] = $this->uniqueSlug($data['name'], $product->id);
            }

            $product->fill($data);
            $changes = array_keys($product->getDirty());
            $product->save();

            $product->images()->whereIn('id', $removeImageIds)->get()->each(function (ProductImage $image) {
                $image->delete();
                // Past orders show the image they were placed with, so it stays while an order points at it.
                if (! OrderItem::where('image_path', $image->path)->exists()) {
                    $this->media->delete($image->path);
                }
            });
            $this->storeImages($product, $images, $stored);

            $this->activity->log('product.updated', $product, ['fields' => $changes]);

            return $product;
        }));
    }

    public function delete(Product $product): void
    {
        $product->delete();
        $this->activity->log('product.deleted', $product, ['sku' => $product->sku]);
    }

    /** @param list<UploadedFile> $images @param list<string> $stored references uploaded so far */
    private function storeImages(Product $product, array $images, array &$stored): void
    {
        $position = (int) $product->images()->max('sort_order');

        foreach ($images as $file) {
            $stored[] = $path = $this->media->store($file, 'products');
            $product->images()->create(['path' => $path, 'alt' => $product->name, 'sort_order' => ++$position]);
        }
    }

    /** Runs a save that uploads images, and removes those uploads again if the save fails. */
    private function withUploads(callable $save): Product
    {
        $stored = [];

        try {
            return $save($stored);
        } catch (Throwable $e) {
            array_map($this->media->deleteNow(...), $stored);
            throw $e;
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
