<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ForgivingSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $men = Category::factory()->create(['name' => 'Men']);
        $tops = Category::factory()->create(['name' => 'Tops', 'parent_id' => $men->id]);
        $bottoms = Category::factory()->create(['name' => 'Bottoms']);

        $make = fn (string $name, Category $category, string $color = 'Black', array $extra = []) => Product::factory()->create([
            'name' => $name, 'category_id' => $category->id, 'colors' => [['name' => $color, 'hex' => '#000']], 'short_description' => null, ...$extra,
        ]);

        $make('Graphic T-shirt', $tops, 'Green');
        $make('Checkered Shirt', $tops);
        $make('Skinny Fit Jeans', $bottoms, 'Blue');
        $make('Bermuda Shorts', $bottoms);
        $make('Polo with Tipping Details', $tops, 'Red');
        $make('Hidden Shirt', $tops, 'Black', ['is_active' => false]);
    }

    public function test_partial_misspelt_and_differently_written_words_still_find_products(): void
    {
        $cases = [
            'shir' => ['Graphic T-shirt', 'Checkered Shirt'],
            'shrit' => ['Graphic T-shirt', 'Checkered Shirt'],
            'tshirt' => ['Graphic T-shirt'],
            't-shirt' => ['Graphic T-shirt'],
            'grafic' => ['Graphic T-shirt'],
            'jean' => ['Skinny Fit Jeans'],
            'skiny' => ['Skinny Fit Jeans'],
            'poloo' => ['Polo with Tipping Details'],
            'checkerd' => ['Checkered Shirt'],
        ];

        foreach ($cases as $query => $expected) {
            $this->assertEqualsCanonicalizing($expected, $this->names($query), "Search for \"{$query}\"");
        }
    }

    public function test_a_close_word_does_not_pull_in_a_different_exact_one(): void
    {
        $this->assertNotContains('Bermuda Shorts', $this->names('shirt'));
        $this->assertNotContains('Bermuda Shorts', $this->names('shrit'));
    }

    public function test_colours_categories_and_synonyms_are_searchable(): void
    {
        $this->assertSame(['Skinny Fit Jeans'], $this->names('blue'));
        $this->assertSame(['Graphic T-shirt'], $this->names('graphic tee'));
        $this->assertEqualsCanonicalizing(['Graphic T-shirt', 'Checkered Shirt'], $this->names('men shirt'));
        $this->assertSame(['Polo with Tipping Details'], $this->names('red polo'));
    }

    public function test_products_matching_every_word_win_and_partial_matches_fill_in_otherwise(): void
    {
        $this->assertSame(['Checkered Shirt'], $this->names('checkered shirt'));
        $this->assertEqualsCanonicalizing(['Skinny Fit Jeans', 'Bermuda Shorts'], $this->names('skinny bermuda'));
        $this->assertSame([], $this->names('xyzzy'));
    }

    public function test_renamed_and_hidden_products_are_reflected_right_away(): void
    {
        $this->names('shirt');
        Product::where('name', 'Bermuda Shorts')->first()->update(['name' => 'Bermuda Cargo']);

        $this->assertSame(['Bermuda Cargo'], $this->names('cargo'));
        $this->assertNotContains('Hidden Shirt', $this->names('hidden'));
    }

    /** @return list<string> */
    private function names(string $query): array
    {
        return array_column($this->getJson('/api/v1/products?per_page=48&search='.urlencode($query))->assertOk()->json('data'), 'name');
    }
}
