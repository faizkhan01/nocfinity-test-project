<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $name = ucwords(fake()->unique()->words(3, true));

        return [
            'category_id' => Category::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'description' => fake()->paragraph(),
            'price_cents' => fake()->numberBetween(1000, 30000),
            'stock' => 20,
            'colors' => [['name' => 'Black', 'hex' => '#000000']],
            'sizes' => ['Medium'],
            'style' => 'casual',
            'is_active' => true,
        ];
    }

    public function outOfStock(): static
    {
        return $this->state(['stock' => 0]);
    }
}
