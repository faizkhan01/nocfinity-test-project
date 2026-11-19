<?php

namespace App\Services\Catalog;

use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Forgiving product search for when no external engine is configured: whole words, prefixes ("shir"),
 * plurals ("jean"), joined forms ("tshirt"), typos ("shrit") and sound-alikes ("grafic"), ranked by coverage.
 */
class ProductMatcher
{
    // Field weights: what a word in that field is worth relative to a word in the product name.
    private const NAME = 1.0;

    private const SKU = 1.0;

    private const COLOR = 0.7;

    private const CATEGORY = 0.6;

    private const STYLE = 0.5;

    private const SUMMARY = 0.35;

    // How strongly each kind of word match counts.
    private const EXACT = 1.0;

    private const PREFIX = 0.85;

    private const INFIX = 0.6;

    private const ONE_TYPO = 0.7;

    private const TWO_TYPOS = 0.55;

    private const SOUNDS_LIKE = 0.6;

    private const STOPWORDS = ['a', 'an', 'and', 'the', 'with', 'for', 'of', 'in', 'on', 'to', 'by'];

    private const MAX_QUERY_WORDS = 8;

    /**
     * Matching product ids, best first.
     *
     * @return list<int>
     */
    public function search(string $query, int $limit = 500): array
    {
        $words = $this->queryWords($query);
        if ($words === []) {
            return [];
        }

        $index = CatalogCache::remember(CatalogCache::SEARCH, fn () => $this->buildIndex());
        $scores = [];   // product id => summed score
        $covered = [];  // product id => number of query words it matched

        foreach ($words as $word) {
            $best = [];
            foreach ($this->expand($word) as $variant => $variantWeight) {
                foreach ($this->matchingTerms($variant, $index) as $term => $quality) {
                    foreach ($index['postings'][$term] as $id => $fieldWeight) {
                        $score = $quality * $fieldWeight * $variantWeight;
                        if ($score > ($best[$id] ?? 0)) {
                            $best[$id] = $score;
                        }
                    }
                }
            }
            foreach ($best as $id => $score) {
                $scores[$id] = ($scores[$id] ?? 0) + $score;
                $covered[$id] = ($covered[$id] ?? 0) + 1;
            }
        }

        if ($scores === []) {
            return [];
        }

        // When some products match every word, only those are shown; otherwise the closest partial matches are.
        $full = array_filter($covered, fn (int $n) => $n === count($words));
        $ids = array_keys($full !== [] ? $full : $covered);

        usort($ids, fn (int $a, int $b) => [$covered[$b], $scores[$b], $index['popularity'][$b] ?? 0, $b]
            <=> [$covered[$a], $scores[$a], $index['popularity'][$a] ?? 0, $a]);

        return array_slice($ids, 0, $limit);
    }

    /**
     * Index terms close to one query word, with match quality. Typos are only tried when nothing
     * starts with the word, so "shirt" never drags in "short".
     *
     * @return array<string, float>
     */
    private function matchingTerms(string $word, array $index): array
    {
        $length = strlen($word);
        $matches = [];

        foreach ($index['postings'] as $term => $_) {
            $term = (string) $term;
            if ($term === $word) {
                $matches[$term] = self::EXACT;
            } elseif (str_starts_with($term, $word)) {
                $matches[$term] = self::PREFIX;
            }
        }
        if ($matches !== [] || $length < 3) {
            return $matches;
        }

        foreach ($index['strong'] as $term => $_) {
            $term = (string) $term;
            if ($length >= 4 && str_contains($term, $word)) {
                $matches[$term] = self::INFIX;
            }
        }
        if ($matches !== [] || $length < 4) {
            return $matches;
        }

        $allowed = $length >= 8 ? 2 : 1;
        $sound = metaphone($word);
        $soundsLike = [];
        foreach ($index['strong'] as $term => $termSound) {
            $term = (string) $term;
            if (abs(strlen($term) - $length) <= $allowed) {
                $distance = $this->distance($word, $term, $allowed);
                if ($distance <= $allowed) {
                    $matches[$term] = $distance === 1 ? self::ONE_TYPO : self::TWO_TYPOS;

                    continue;
                }
            }
            // A typo while still typing: compare with the start of the longer word ("sleev" ~ "slee").
            if (strlen($term) > $length && $this->distance($word, substr($term, 0, $length), 1) <= 1) {
                $matches[$term] = self::TWO_TYPOS;
            } elseif ($sound !== '' && strlen($term) >= 4 && $termSound === $sound) {
                $soundsLike[$term] = self::SOUNDS_LIKE;
            }
        }

        // Sound-alikes are the last resort: "shrit" is a typo of "shirt", not "short".
        return $matches !== [] ? $matches : $soundsLike;
    }

    /** @return array{postings: array<string, array<int, float>>, strong: array<string, string>, popularity: array<int, int>} */
    private function buildIndex(): array
    {
        $postings = [];
        $strong = [];
        $popularity = [];

        $add = function (int $id, ?string $text, float $weight, bool $fuzzy) use (&$postings, &$strong) {
            foreach ($this->documentTerms($text) as $term) {
                $postings[$term][$id] = max($postings[$term][$id] ?? 0, $weight);
                if ($fuzzy) {
                    $strong[$term] = metaphone($term);
                }
            }
        };

        Product::query()->active()
            ->whereHas('category', fn ($q) => $q->active())
            ->with('category:id,name,parent_id', 'category.parent:id,name')
            ->select(['id', 'category_id', 'name', 'sku', 'short_description', 'colors', 'style', 'sold_count'])
            ->chunkById(500, function ($products) use ($add, &$popularity) {
                foreach ($products as $product) {
                    $add($product->id, $product->name, self::NAME, true);
                    $add($product->id, $product->sku, self::SKU, false);
                    $add($product->id, implode(' ', array_column($product->colors ?? [], 'name')), self::COLOR, true);
                    $add($product->id, $product->category?->name.' '.$product->category?->parent?->name, self::CATEGORY, true);
                    $add($product->id, $product->style, self::STYLE, true);
                    $add($product->id, $product->short_description, self::SUMMARY, false);
                    $popularity[$product->id] = (int) $product->sold_count;
                }
            });

        return ['postings' => $postings, 'strong' => $strong, 'popularity' => $popularity];
    }

    /**
     * Terms stored for a text: each word plus each joined pair ("t-shirt" => "tshirt"), in singular form.
     *
     * @return list<string>
     */
    private function documentTerms(?string $text): array
    {
        $words = $this->words((string) $text);
        $terms = $words;
        for ($i = 0; $i < count($words) - 1; $i++) {
            $terms[] = $words[$i].$words[$i + 1];
        }

        return array_values(array_unique(array_map($this->singular(...), $terms)));
    }

    /** @return list<string> */
    private function queryWords(string $query): array
    {
        // A hyphenated query word is meant as one word ("t-shirt"), so join it before splitting.
        $query = preg_replace('/(?<=\p{L}|\p{N})-(?=\p{L}|\p{N})/u', '', $query);
        $words = $this->words($query);
        $meaningful = array_values(array_diff($words, self::STOPWORDS));

        $words = array_map($this->singular(...), $meaningful !== [] ? $meaningful : $words);

        return array_slice(array_values(array_unique($words)), 0, self::MAX_QUERY_WORDS);
    }

    /** @return list<string> */
    private function words(string $text): array
    {
        $text = Str::lower(Str::ascii($text));

        return array_values(array_filter(preg_split('/[^a-z0-9]+/', $text) ?: [], fn ($w) => $w !== ''));
    }

    /**
     * The word plus configured synonyms ("tee" => "tshirt"), each with its weight.
     *
     * @return array<string, float>
     */
    private function expand(string $word): array
    {
        $variants = [$word => 1.0];
        foreach (config('shop.search_synonyms', []) as $group) {
            $group = array_map(fn ($w) => $this->singular(Str::lower($w)), $group);
            if (in_array($word, $group, true)) {
                foreach ($group as $synonym) {
                    $variants[$synonym] ??= 0.9;
                }
            }
        }

        return $variants;
    }

    /** Light singular, applied the same way to the catalog and the query: "jeans" => "jean", "dress" stays. */
    private function singular(string $word): string
    {
        if (strlen($word) <= 3 || ctype_digit($word)) {
            return $word;
        }
        if (str_ends_with($word, 's') && ! preg_match('/(ss|us|is)$/', $word)) {
            return substr($word, 0, -1);
        }

        return $word;
    }

    /** Edit distance counting a swap of two neighbours as one edit; stops early past `$max`. */
    private function distance(string $a, string $b, int $max): int
    {
        $la = strlen($a);
        $lb = strlen($b);
        if (abs($la - $lb) > $max) {
            return $max + 1;
        }

        $d = [];
        for ($i = 0; $i <= $la; $i++) {
            $d[$i][0] = $i;
        }
        for ($j = 0; $j <= $lb; $j++) {
            $d[0][$j] = $j;
        }
        for ($i = 1; $i <= $la; $i++) {
            $rowMin = PHP_INT_MAX;
            for ($j = 1; $j <= $lb; $j++) {
                $cost = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
                $d[$i][$j] = min($d[$i - 1][$j] + 1, $d[$i][$j - 1] + 1, $d[$i - 1][$j - 1] + $cost);
                if ($i > 1 && $j > 1 && $a[$i - 1] === $b[$j - 2] && $a[$i - 2] === $b[$j - 1]) {
                    $d[$i][$j] = min($d[$i][$j], $d[$i - 2][$j - 2] + 1);
                }
                $rowMin = min($rowMin, $d[$i][$j]);
            }
            if ($rowMin > $max) {
                return $max + 1;
            }
        }

        return $d[$la][$lb];
    }
}
