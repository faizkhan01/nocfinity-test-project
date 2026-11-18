<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\File;
use Illuminate\Support\Facades\Storage;

class PublishSeedImages extends Command
{
    protected $signature = 'app:publish-seed-images';

    protected $description = 'Copy any missing demo product images onto the public disk (e.g. a fresh or replaced volume).';

    public function handle(): int
    {
        $copied = 0;

        foreach (glob(database_path('seeders/images/products/*.jpg')) ?: [] as $path) {
            $target = 'products/seed/'.basename($path);

            if (! Storage::disk('public')->exists($target)) {
                Storage::disk('public')->putFileAs('products/seed', new File($path), basename($path));
                $copied++;
            }
        }

        $this->info("Published {$copied} seed image(s).");

        return self::SUCCESS;
    }
}
