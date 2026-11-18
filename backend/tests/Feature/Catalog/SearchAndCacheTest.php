<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Services\Catalog\CatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Scout\Builder;
use Laravel\Scout\EngineManager;
use Laravel\Scout\Engines\CollectionEngine;
use RuntimeException;
use Tests\TestCase;

class SearchAndCacheTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_results_still_respect_the_database_filters(): void
    {
        Product::factory()->create(['name' => 'Linen Shirt Blue', 'price_cents' => 5000]);
        Product::factory()->create(['name' => 'Linen Shirt Red', 'price_cents' => 15000]);
        Product::factory()->create(['name' => 'Linen Shirt Hidden', 'is_active' => false]);

        $this->getJson('/api/v1/products?search=linen')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/products?search=linen&max_price=10000')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.name', 'Linen Shirt Blue');
    }

    public function test_search_defaults_to_the_engine_relevance_order(): void
    {
        $first = Product::factory()->create(['name' => 'Alpha Jacket']);
        $second = Product::factory()->create(['name' => 'Beta Jacket']);
        $this->fakeEngineReturning([$second->id, $first->id]);

        $this->getJson('/api/v1/products?search=jacket')
            ->assertJsonPath('data.0.name', 'Beta Jacket')
            ->assertJsonPath('data.1.name', 'Alpha Jacket');

        $this->getJson('/api/v1/products?search=jacket&sort=newest')->assertJsonPath('data.0.name', 'Beta Jacket');
    }

    public function test_an_exact_sku_returns_only_that_product(): void
    {
        $target = Product::factory()->create(['sku' => 'SC-0042']);
        Product::factory()->create(['sku' => 'SC-0043']);

        $this->getJson('/api/v1/products?search=sc-0042')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $target->id);
    }

    public function test_search_falls_back_to_the_database_when_the_engine_is_down(): void
    {
        Product::factory()->create(['name' => 'Corduroy Trousers']);
        $this->app->make(EngineManager::class)->extend('broken', fn () => new class extends CollectionEngine
        {
            public function search(Builder $builder)
            {
                throw new RuntimeException('Meilisearch is unreachable');
            }
        });
        config(['scout.driver' => 'broken']);

        $this->getJson('/api/v1/products?search=corduroy')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Corduroy Trousers');
    }

    public function test_catalog_cache_is_dropped_when_products_or_categories_change(): void
    {
        $category = Category::factory()->create(['name' => 'Knitwear']);
        $product = Product::factory()->create(['category_id' => $category->id, 'colors' => [['name' => 'Black', 'hex' => '#000000']]]);

        $this->getJson('/api/v1/categories')->assertJsonPath('data.0.name', 'Knitwear');
        $this->getJson('/api/v1/products/filters');
        $this->assertTrue(Cache::has(CatalogCache::CATEGORIES));
        $this->assertTrue(Cache::has(CatalogCache::FACETS));

        $product->update(['stock' => 3]);
        $this->assertTrue(Cache::has(CatalogCache::FACETS), 'Stock changes do not touch the facets');

        $product->update(['colors' => [['name' => 'Teal', 'hex' => '#008080']]]);
        $this->assertFalse(Cache::has(CatalogCache::FACETS));
        $this->getJson('/api/v1/products/filters')->assertJsonPath('data.colors.0.name', 'Teal');

        $category->update(['name' => 'Sweaters']);
        $this->getJson('/api/v1/categories')->assertJsonPath('data.0.name', 'Sweaters');
    }

    public function test_only_relevant_changes_reindex_and_inactive_products_are_not_searchable(): void
    {
        $product = Product::factory()->create();
        $product->stock = 1;
        $product->save();
        $this->assertFalse($product->searchIndexShouldBeUpdated(), 'A stock change should not re-index');

        $product->name = 'Renamed Product';
        $product->save();
        $this->assertTrue($product->searchIndexShouldBeUpdated());

        $product->update(['is_active' => false]);
        $this->assertFalse($product->shouldBeSearchable());
    }

    /** @param list<int> $ids */
    private function fakeEngineReturning(array $ids): void
    {
        $this->app->make(EngineManager::class)->extend('fixed', fn () => new class($ids) extends CollectionEngine
        {
            public function __construct(private array $ids) {}

            public function search(Builder $builder)
            {
                return ['results' => $this->ids, 'total' => count($this->ids)];
            }

            public function keys(Builder $builder)
            {
                return collect($this->ids);
            }
        });
        config(['scout.driver' => 'fixed']);
    }
}
