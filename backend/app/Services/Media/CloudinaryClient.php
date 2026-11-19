<?php

namespace App\Services\Media;

use App\Exceptions\ApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Throwable;

/** Signed calls to Cloudinary's Upload API and its delivery URLs (https://cloudinary.com/documentation/image_upload_api_reference). */
class CloudinaryClient
{
    private const API = 'https://api.cloudinary.com/v1_1';

    private const CDN = 'https://res.cloudinary.com';

    public function __construct(
        private readonly string $cloudName,
        private readonly string $apiKey,
        private readonly string $apiSecret,
        private readonly int $maxDimension = 2000,
        private readonly int $timeout = 30,
    ) {}

    /** Builds a client from CLOUDINARY_URL (cloudinary://key:secret@cloud). */
    public static function fromUrl(?string $url, int $maxDimension = 2000, int $timeout = 30): self
    {
        $parts = parse_url((string) $url);

        if (($parts['scheme'] ?? null) !== 'cloudinary' || empty($parts['host']) || empty($parts['user']) || empty($parts['pass'])) {
            throw new InvalidArgumentException('MEDIA_DRIVER=cloudinary needs CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>.');
        }

        return new self($parts['host'], rawurldecode($parts['user']), rawurldecode($parts['pass']), $maxDimension, $timeout);
    }

    /**
     * Uploads a local file under a fixed public ID. An existing asset with that ID is kept, which makes re-runs idempotent.
     *
     * @return array{public_id: string, version: int}
     */
    public function upload(string $filePath, string $publicId): array
    {
        $params = [
            'public_id' => $publicId,
            'overwrite' => 'false',
            'transformation' => "c_limit,h_{$this->maxDimension},w_{$this->maxDimension}",
        ];

        // Contents rather than a stream, so a retried request sends the file again.
        $response = $this->post('image/upload', $params, fn ($request) => $request->attach('file', file_get_contents($filePath), basename($filePath)));

        return ['public_id' => (string) $response->json('public_id'), 'version' => (int) $response->json('version')];
    }

    /** Deletes the asset and purges it from the CDN; a missing asset is not an error. */
    public function destroy(string $publicId): void
    {
        $this->post('image/destroy', ['public_id' => $publicId, 'invalidate' => 'true']);
    }

    /** Delivery URL with automatic format (AVIF/WebP) and quality; clients add a width on top. */
    public function url(string $publicId, int $version): string
    {
        return self::CDN."/{$this->cloudName}/image/upload/f_auto,q_auto/v{$version}/{$publicId}";
    }

    /** Signature over every signed parameter, sorted by name (Cloudinary "authentication signatures"). */
    public function sign(array $params): string
    {
        ksort($params);
        $payload = collect($params)->map(fn ($value, $key) => "{$key}={$value}")->implode('&');

        return sha1($payload.$this->apiSecret);
    }

    private function post(string $endpoint, array $params, ?callable $attach = null): Response
    {
        $params['timestamp'] = time();
        $fields = [...$params, 'signature' => $this->sign($params), 'api_key' => $this->apiKey];

        try {
            // Retry only what can succeed on a second try: dropped connections and Cloudinary-side errors.
            $request = Http::timeout($this->timeout)->asMultipart()->retry(
                2,
                500,
                fn (Throwable $e) => $e instanceof ConnectionException || ($e instanceof RequestException && $e->response->serverError()),
                throw: false,
            );
            $request = $attach ? $attach($request) : $request;
            $response = $request->post(self::API."/{$this->cloudName}/{$endpoint}", $fields);
        } catch (ConnectionException $e) {
            Log::warning('Cloudinary unreachable', ['endpoint' => $endpoint, 'error' => $e->getMessage()]);
            throw $this->unavailable();
        }

        if ($response->failed()) {
            Log::warning('Cloudinary request failed', ['endpoint' => $endpoint, 'status' => $response->status(), 'error' => $response->json('error.message')]);
            throw $this->unavailable();
        }

        return $response;
    }

    private function unavailable(): ApiException
    {
        return new ApiException('The image service is unavailable right now. Please try again in a moment.', 'media_unavailable', 503);
    }
}
