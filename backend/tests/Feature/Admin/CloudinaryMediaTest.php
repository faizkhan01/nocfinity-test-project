<?php

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\Media\CloudinaryClient;
use App\Services\Media\MediaStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Tests\TestCase;

class CloudinaryMediaTest extends TestCase
{
    use RefreshDatabase;

    private const UPLOAD = 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload';

    private const DESTROY = 'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config([
            'media.driver' => 'cloudinary',
            'media.cloudinary.url' => 'cloudinary://key123:secret456@demo-cloud',
            'media.cloudinary.folder' => 'test',
        ]);
        $this->seedRoles();
    }

    public function test_signatures_match_cloudinarys_documented_example(): void
    {
        $client = new CloudinaryClient('demo', 'key', 'abcd');

        $this->assertSame(
            'bfd09f95f331f558cbd1320e67aa8d488770583e',
            $client->sign(['timestamp' => 1315060510, 'public_id' => 'sample_image', 'eager' => 'w_400,h_300,c_pad|w_260,h_200,c_crop']),
        );
    }

    public function test_an_uploaded_product_image_goes_to_cloudinary_and_is_served_from_the_cdn(): void
    {
        $this->fakeCloudinary();
        $this->actingAsStaff('product-manager');

        $response = $this->post('/api/v1/admin/products', $this->productPayload(), ['Accept' => 'application/json'])->assertCreated();

        $image = ProductImage::sole();
        $this->assertMatchesRegularExpression('#^cloudinary:v1700000000/test/products/[A-Za-z0-9]{40}$#', $image->path);
        $this->assertSame(
            'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/v1700000000/'.substr($image->path, strlen('cloudinary:v1700000000/')),
            $response->json('data.images.0.url'),
        );
        $this->assertSame([], Storage::disk('public')->allFiles(), 'Nothing is written to the local disk');

        Http::assertSent(function (Request $request) {
            $fields = $this->fields($request);

            return $request->url() === self::UPLOAD
                && $fields['api_key'] === 'key123'
                && $fields['overwrite'] === 'false'
                && $fields['transformation'] === 'c_limit,h_2000,w_2000'
                && $fields['signature'] === sha1("overwrite=false&public_id={$fields['public_id']}&timestamp={$fields['timestamp']}&transformation=c_limit,h_2000,w_2000secret456")
                && $request->hasFile('file');
        });
    }

    public function test_a_removed_image_is_deleted_from_cloudinary_unless_a_past_order_shows_it(): void
    {
        $this->fakeCloudinary();
        $product = Product::factory()->create();
        $kept = $product->images()->create(['path' => 'cloudinary:v1/test/products/ordered', 'sort_order' => 1]);
        $gone = $product->images()->create(['path' => 'cloudinary:v1/test/products/unused', 'sort_order' => 2]);
        $this->orderItemShowing($kept->path);
        $this->actingAsStaff('product-manager');

        $this->put("/api/v1/admin/products/{$product->id}", [
            ...$this->productPayload(withImage: false),
            'sku' => $product->sku,
            'remove_image_ids' => [$kept->id, $gone->id],
            'images' => [UploadedFile::fake()->image('new.jpg', 400, 400)],
        ], ['Accept' => 'application/json'])->assertOk();

        Http::assertSent(fn (Request $r) => $r->url() === self::DESTROY && $this->fields($r)['public_id'] === 'test/products/unused' && $this->fields($r)['invalidate'] === 'true');
        Http::assertNotSent(fn (Request $r) => $r->url() === self::DESTROY && $this->fields($r)['public_id'] === 'test/products/ordered');
        $this->assertSame(1, $product->images()->count());
    }

    public function test_when_cloudinary_is_down_the_save_fails_cleanly_and_keeps_nothing_half_done(): void
    {
        Http::fake([
            self::UPLOAD => Http::sequence()
                ->push(['public_id' => 'test/products/first', 'version' => 1])
                ->whenEmpty(Http::response(['error' => ['message' => 'Server error']], 500)),
            self::DESTROY => Http::response(['result' => 'ok']),
        ]);
        $this->actingAsStaff('product-manager');

        $this->post('/api/v1/admin/products', [
            ...$this->productPayload(withImage: false),
            'images' => [UploadedFile::fake()->image('a.jpg', 400, 400), UploadedFile::fake()->image('b.jpg', 400, 400)],
        ], ['Accept' => 'application/json'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'media_unavailable');

        $this->assertSame(0, Product::count());
        Http::assertSent(fn (Request $r) => $r->url() === self::DESTROY && $this->fields($r)['public_id'] === 'test/products/first');
    }

    public function test_a_new_category_image_replaces_the_old_one_only_after_it_is_stored(): void
    {
        $this->fakeCloudinary();
        $category = Category::factory()->create(['image_path' => 'categories/old.jpg']);
        Storage::disk('public')->put('categories/old.jpg', 'x');
        $this->actingAsStaff('product-manager');

        $this->put("/api/v1/admin/categories/{$category->id}", [
            'name' => $category->name,
            'is_active' => '1',
            'image' => UploadedFile::fake()->image('new.jpg', 400, 400),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.image', fn (string $url) => str_starts_with($url, 'https://res.cloudinary.com/demo-cloud/image/upload/'));

        Storage::disk('public')->assertMissing('categories/old.jpg');
    }

    public function test_local_and_cloudinary_images_are_served_side_by_side(): void
    {
        $media = app(MediaStorage::class);

        $this->assertSame('/storage/products/seed/tee.jpg', parse_url($media->url('products/seed/tee.jpg'), PHP_URL_PATH));
        $this->assertSame('https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/v42/test/products/abc', $media->url('cloudinary:v42/test/products/abc'));
        $this->assertNull($media->url(null));
    }

    public function test_a_missing_or_malformed_cloudinary_url_fails_with_a_clear_message(): void
    {
        config(['media.cloudinary.url' => 'https://key:secret@demo']);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('CLOUDINARY_URL=cloudinary://');

        app(MediaStorage::class)->url('cloudinary:v1/test/x');
    }

    public function test_existing_local_images_can_be_moved_to_cloudinary(): void
    {
        $this->fakeCloudinary(publicId: 'test/products/seed/tee');
        Storage::disk('public')->put('products/seed/tee.jpg', UploadedFile::fake()->image('tee.jpg', 300, 300)->getContent());
        $image = Product::factory()->create()->images()->create(['path' => 'products/seed/tee.jpg', 'sort_order' => 1]);
        $item = $this->orderItemShowing('products/seed/tee.jpg');
        $image->product->images()->create(['path' => 'products/seed/gone.jpg', 'sort_order' => 2]);

        $this->artisan('app:move-media-to-cloudinary')->assertSuccessful();

        $this->assertSame('cloudinary:v1700000000/test/products/seed/tee', $image->fresh()->path);
        $this->assertSame('cloudinary:v1700000000/test/products/seed/tee', $item->fresh()->image_path);
        $this->assertSame('products/seed/gone.jpg', ProductImage::where('sort_order', 2)->value('path'), 'Missing files are left alone');
        Http::assertSentCount(1);
    }

    private function orderItemShowing(string $path): OrderItem
    {
        return Order::factory()->create()->items()->forceCreate([
            'product_name' => 'Old Tee', 'product_sku' => 'OLD-1', 'image_path' => $path,
            'unit_price_cents' => 1000, 'quantity' => 1, 'line_total_cents' => 1000,
        ]);
    }

    private function fakeCloudinary(?string $publicId = null): void
    {
        Http::fake([
            self::UPLOAD => fn (Request $r) => Http::response(['public_id' => $publicId ?? $this->fields($r)['public_id'], 'version' => 1700000000]),
            self::DESTROY => Http::response(['result' => 'ok']),
        ]);
    }

    /** @return array<string, string> the multipart text fields of a request */
    private function fields(Request $request): array
    {
        return collect($request->data())->reject(fn (array $part) => $part['name'] === 'file')
            ->mapWithKeys(fn (array $part) => [$part['name'] => (string) $part['contents']])->all();
    }

    private function productPayload(bool $withImage = true): array
    {
        return array_filter([
            'name' => 'Cloud Tee',
            'sku' => 'CLOUD-TEE',
            'category_id' => Category::factory()->create()->id,
            'price_cents' => 5000,
            'stock' => 10,
            'is_active' => '1',
            'images' => $withImage ? [UploadedFile::fake()->image('tee.jpg', 400, 400)] : null,
        ]);
    }
}
