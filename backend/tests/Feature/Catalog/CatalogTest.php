<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_listing_filters_by_parent_category_price_and_colour(): void
    {
        $men = Category::factory()->create(['slug' => 'men']);
        $tees = Category::factory()->create(['slug' => 'tees', 'parent_id' => $men->id]);
        Product::factory()->create(['category_id' => $tees->id, 'name' => 'Red Tee', 'price_cents' => 5000, 'colors' => [['name' => 'Red', 'hex' => '#F50606']]]);
        Product::factory()->create(['category_id' => $tees->id, 'name' => 'Cheap Sale Tee', 'price_cents' => 9000, 'discount_price_cents' => 2000]);
        Product::factory()->create(['name' => 'Elsewhere']);
        Product::factory()->create(['category_id' => $tees->id, 'name' => 'Hidden', 'is_active' => false]);

        $this->getJson('/api/v1/products?category=men')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/products?colors=Red')->assertJsonPath('data.0.name', 'Red Tee')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/products?category=men&sort=price_asc')->assertJsonPath('data.0.name', 'Cheap Sale Tee');
        $this->getJson('/api/v1/products?max_price=3000')->assertJsonPath('meta.total', 1);
    }

    public function test_listing_is_paginated_with_metadata(): void
    {
        Product::factory()->count(12)->create();

        $this->getJson('/api/v1/products?per_page=5&page=2')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.total', 12);
    }

    public function test_unknown_sorts_and_oversized_pages_are_rejected(): void
    {
        $this->getJson('/api/v1/products?sort=password')->assertUnprocessable();
        $this->getJson('/api/v1/products?per_page=1000')->assertUnprocessable();
    }

    public function test_search_treats_wildcards_literally(): void
    {
        Product::factory()->create(['name' => '100% Cotton Tee']);
        Product::factory()->create(['name' => 'Wool Jumper']);

        $this->getJson('/api/v1/products?search=%25')->assertJsonPath('meta.total', 1);
    }

    public function test_inactive_products_are_not_reachable(): void
    {
        $product = Product::factory()->create(['is_active' => false]);

        $this->getJson("/api/v1/products/{$product->slug}")->assertNotFound();
    }
}
