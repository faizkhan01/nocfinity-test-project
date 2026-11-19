<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\OrderItem;
use App\Models\ProductImage;
use App\Services\Catalog\CatalogCache;
use App\Services\Media\MediaStorage;
use Illuminate\Console\Command;
use Illuminate\Http\File;
use Illuminate\Support\Facades\Storage;

class MoveMediaToCloudinary extends Command
{
    protected $signature = 'app:move-media-to-cloudinary {--dry-run : List what would move without uploading}';

    protected $description = 'Upload images still on the public disk to Cloudinary and point products, categories and past orders at them.';

    public function handle(MediaStorage $media): int
    {
        if ($media->driver() !== 'cloudinary') {
            $this->error('Set MEDIA_DRIVER=cloudinary and CLOUDINARY_URL first.');

            return self::FAILURE;
        }

        $references = collect([
            ProductImage::pluck('path'),
            Category::whereNotNull('image_path')->pluck('image_path'),
            OrderItem::whereNotNull('image_path')->pluck('image_path'),
        ])->flatten()->unique()->reject(fn (string $ref) => $media->isCloudinary($ref))->values();

        $this->info("{$references->count()} local image(s) to move.");
        $moved = $missing = 0;

        foreach ($references as $path) {
            if (! Storage::disk('public')->exists($path)) {
                $this->warn("Missing on disk, left as is: {$path}");
                $missing++;

                continue;
            }

            if ($this->option('dry-run')) {
                $this->line("Would move {$path}");

                continue;
            }

            // The local path (minus extension) becomes the public ID, so a re-run reuses what is already uploaded.
            $info = pathinfo($path);
            $reference = $media->store(new File(Storage::disk('public')->path($path)), $info['dirname'], $info['filename']);

            ProductImage::where('path', $path)->update(['path' => $reference]);
            Category::where('image_path', $path)->update(['image_path' => $reference]);
            OrderItem::where('image_path', $path)->update(['image_path' => $reference]);
            $this->line("{$path} → {$reference}");
            $moved++;
        }

        // Bulk updates skip model events, so the cached category tree is dropped by hand.
        CatalogCache::flush();
        $this->info("Moved {$moved}, missing {$missing}. Local files are kept; remove them once the site looks right.");

        return self::SUCCESS;
    }
}
