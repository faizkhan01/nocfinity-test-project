<?php

namespace App\Services\Media;

use Illuminate\Http\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Stores uploaded images on the public disk or on Cloudinary and turns stored references back into URLs.
 * Cloudinary references look like "cloudinary:v<version>/<public_id>", so both kinds can live side by side.
 */
class MediaStorage
{
    private const PREFIX = 'cloudinary:';

    private ?CloudinaryClient $cloudinary = null;

    public function driver(): string
    {
        return config('media.driver') === 'cloudinary' ? 'cloudinary' : 'local';
    }

    /** Stores a file in a folder ("products", "categories") and returns the reference to save. `$name` fixes the stored name. */
    public function store(UploadedFile|File $file, string $folder, ?string $name = null): string
    {
        $name ??= Str::random(40);

        if ($this->driver() === 'local') {
            return Storage::disk('public')->putFileAs($folder, $file, $name.'.'.($file->guessExtension() ?: 'jpg'));
        }

        $publicId = trim(config('media.cloudinary.folder'), '/')."/{$folder}/{$name}";
        $uploaded = $this->cloudinary()->upload($file->getRealPath(), $publicId);

        return self::PREFIX."v{$uploaded['version']}/{$uploaded['public_id']}";
    }

    public function url(?string $reference): ?string
    {
        if (! $reference) {
            return null;
        }

        if (! $this->isCloudinary($reference)) {
            return Storage::disk('public')->url($reference);
        }

        [$version, $publicId] = $this->parse($reference);

        return $this->cloudinary()->url($publicId, $version);
    }

    /** Deletes the stored file once the surrounding transaction commits, so a rollback never loses an image. */
    public function delete(?string $reference): void
    {
        if ($reference) {
            DB::afterCommit(fn () => $this->deleteNow($reference));
        }
    }

    /** Deletes right away (e.g. uploads of a save that failed). A failure only leaves an orphaned file, so it is logged, not thrown. */
    public function deleteNow(string $reference): void
    {
        try {
            if ($this->isCloudinary($reference)) {
                $this->cloudinary()->destroy($this->parse($reference)[1]);
            } else {
                Storage::disk('public')->delete($reference);
            }
        } catch (Throwable $e) {
            Log::warning('Could not delete a stored image', ['reference' => $reference, 'error' => $e->getMessage()]);
        }
    }

    public function isCloudinary(string $reference): bool
    {
        return str_starts_with($reference, self::PREFIX);
    }

    public function cloudinary(): CloudinaryClient
    {
        return $this->cloudinary ??= CloudinaryClient::fromUrl(
            config('media.cloudinary.url'),
            (int) config('media.cloudinary.max_dimension'),
            (int) config('media.cloudinary.timeout'),
        );
    }

    /** @return array{0: int, 1: string} version and public ID */
    private function parse(string $reference): array
    {
        $rest = substr($reference, strlen(self::PREFIX));
        [$version, $publicId] = explode('/', $rest, 2);

        return [(int) ltrim($version, 'v'), $publicId];
    }
}
