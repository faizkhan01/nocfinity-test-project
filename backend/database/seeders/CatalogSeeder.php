<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Http\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CatalogSeeder extends Seeder
{
    private const COLORS = [
        'Green' => '#00C12B', 'Red' => '#F50606', 'Yellow' => '#F5DD06', 'Orange' => '#F57906', 'Cyan' => '#06CAF5',
        'Blue' => '#063AF5', 'Purple' => '#7D06F5', 'Pink' => '#F506A4', 'White' => '#FFFFFF', 'Black' => '#000000',
    ];

    private const TREE = [
        'Men' => ['T-shirts', 'Shirts', 'Polos', 'Jeans', 'Shorts'],
        'Unisex' => ['Graphic Tees'],
    ];

    /** name, category, price, discount, style, colours, sizes, images, featured, days old, sold */
    private const PRODUCTS = [
        ['T-shirt with Tape Details', 'T-shirts', 120, null, 'casual', ['Black', 'White'], ['Small', 'Medium', 'Large', 'X-Large'], ['tshirt-tape-details'], true, 1, 40],
        ['Skinny Fit Jeans', 'Jeans', 260, 240, 'casual', ['Blue', 'Black'], ['Small', 'Medium', 'Large', 'X-Large'], ['skinny-fit-jeans'], true, 2, 55],
        ['Checkered Shirt', 'Shirts', 180, null, 'casual', ['Red', 'Blue'], ['Medium', 'Large', 'X-Large'], ['checkered-shirt'], true, 3, 35],
        ['Sleeve Striped T-shirt', 'T-shirts', 160, 130, 'casual', ['Orange', 'Black'], ['Small', 'Medium', 'Large'], ['sleeve-striped-tshirt'], true, 4, 48],
        ['Vertical Striped Shirt', 'Shirts', 232, 212, 'formal', ['Green', 'White'], ['Medium', 'Large', 'X-Large', 'XX-Large'], ['vertical-striped-shirt'], true, 20, 160],
        ['Courage Graphic T-shirt', 'Graphic Tees', 145, null, 'casual', ['Orange', 'White'], ['Small', 'Medium', 'Large'], ['courage-graphic-tshirt'], true, 22, 150],
        ['Loose Fit Bermuda Shorts', 'Shorts', 80, null, 'gym', ['Blue'], ['Small', 'Medium', 'Large', 'X-Large'], ['bermuda-shorts'], false, 25, 140],
        ['Faded Skinny Jeans', 'Jeans', 210, null, 'casual', ['Black'], ['Small', 'Medium', 'Large', 'X-Large', 'XX-Large'], ['faded-skinny-jeans'], false, 26, 130],
        ['One Life Graphic T-shirt', 'Graphic Tees', 300, 260, 'casual', [['Olive', '#4F4631'], ['Forest', '#314F4A'], ['Navy', '#31344F']], ['Small', 'Medium', 'Large', 'X-Large'], ['one-life-graphic-tshirt', 'one-life-graphic-tshirt-2', 'one-life-graphic-tshirt-3'], true, 6, 90],
        ['Polo with Contrast Trims', 'Polos', 242, 212, 'formal', ['Blue', 'White'], ['Medium', 'Large', 'X-Large'], ['polo-contrast-trims'], false, 8, 60],
        ['Gradient Graphic T-shirt', 'Graphic Tees', 145, null, 'party', ['White', 'Pink'], ['XX-Small', 'X-Small', 'Small', 'Medium', 'Large'], ['gradient-graphic-tshirt'], false, 9, 70],
        ['Polo with Tipping Details', 'Polos', 180, null, 'formal', ['Pink', 'Red'], ['Small', 'Medium', 'Large', 'X-Large'], ['polo-tipping-details'], false, 10, 45],
        ['Black Striped T-shirt', 'T-shirts', 150, 120, 'party', ['White', 'Black'], ['Small', 'Medium', 'Large', '3X-Large', '4X-Large'], ['black-striped-tshirt'], false, 11, 65],
        ['Classic Blue Denim', 'Jeans', 190, 165, 'casual', ['Blue'], ['Medium', 'Large', 'X-Large', 'XX-Large'], ['skinny-fit-jeans'], false, 14, 25],
        ['Washed Black Straight Jeans', 'Jeans', 175, null, 'formal', ['Black'], ['Small', 'Medium', 'Large'], ['faded-skinny-jeans'], false, 15, 18],
        ['Plaid Flannel Overshirt', 'Shirts', 155, null, 'casual', ['Red', 'Purple'], ['Large', 'X-Large', 'XX-Large'], ['checkered-shirt'], false, 16, 12],
        ['Raglan Stripe Gym Tee', 'T-shirts', 95, 75, 'gym', ['Orange', 'Yellow'], ['Small', 'Medium', 'Large'], ['sleeve-striped-tshirt'], false, 17, 22],
        ['Denim Training Shorts', 'Shorts', 70, null, 'gym', ['Blue', 'Cyan'], ['Small', 'Medium', 'Large'], ['bermuda-shorts'], false, 18, 15],
        ['Street Art Graphic Tee', 'Graphic Tees', 110, null, 'party', ['Orange', 'Yellow'], ['Medium', 'Large', 'X-Large'], ['courage-graphic-tshirt'], false, 19, 8],
        ['Mandarin Collar Linen Shirt', 'Shirts', 205, null, 'formal', ['Green'], ['Medium', 'Large'], ['vertical-striped-shirt'], false, 28, 3],
    ];

    public function run(): void
    {
        $categories = [];
        foreach (array_keys(self::TREE) as $i => $parentName) {
            $parent = Category::create(['name' => $parentName, 'slug' => Str::slug($parentName), 'sort_order' => $i]);

            foreach (self::TREE[$parentName] as $j => $childName) {
                $categories[$childName] = Category::create([
                    'name' => $childName, 'slug' => Str::slug($childName), 'parent_id' => $parent->id, 'sort_order' => $j,
                ]);
            }
        }

        $stored = [];
        foreach (self::PRODUCTS as $i => [$name, $category, $price, $discount, $style, $colors, $sizes, $images, $featured, $daysOld, $sold]) {
            $product = new Product([
                'category_id' => $categories[$category]->id,
                'name' => $name,
                'slug' => Str::slug($name),
                'sku' => 'SC-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
                'short_description' => "This {$this->noun($category)} is perfect for any occasion. Crafted from a soft and breathable fabric, it offers superior comfort and style.",
                'description' => "The {$name} is made for everyday wear.\n\nMaterial: 100% premium cotton\nFit: regular, true to size\nCare: machine wash cold, tumble dry low",
                'price_cents' => $price * 100,
                'discount_price_cents' => $discount ? $discount * 100 : null,
                'stock' => $i === 19 ? 0 : ($i === 18 ? 3 : 25 + ($i * 7) % 40),
                'low_stock_threshold' => 5,
                'colors' => array_map(fn ($c) => is_array($c) ? ['name' => $c[0], 'hex' => $c[1]] : ['name' => $c, 'hex' => self::COLORS[$c]], $colors),
                'sizes' => $sizes,
                'style' => $style,
                'is_active' => true,
                'is_featured' => $featured,
            ]);
            $product->sold_count = $sold;
            $product->created_at = now()->subDays($daysOld);
            $product->save();

            foreach ($images as $position => $image) {
                $stored[$image] ??= Storage::disk('public')->putFileAs('products/seed', new File(database_path("seeders/images/products/{$image}.jpg")), "{$image}.jpg");
                $product->images()->create(['path' => $stored[$image], 'alt' => $name, 'sort_order' => $position]);
            }
        }
    }

    private function noun(string $category): string
    {
        return match ($category) {
            'Jeans' => 'pair of jeans',
            'Shorts' => 'pair of shorts',
            'Shirts' => 'shirt',
            'Polos' => 'polo',
            default => 't-shirt',
        };
    }
}
