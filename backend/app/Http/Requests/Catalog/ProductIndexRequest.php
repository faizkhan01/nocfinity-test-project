<?php

namespace App\Http\Requests\Catalog;

use App\Services\Catalog\ProductSearch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductIndexRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        // Accept both colors=Red,Blue and colors[]=Red.
        foreach (['colors', 'sizes', 'styles'] as $key) {
            if (is_string($this->query($key))) {
                $this->merge([$key => array_values(array_filter(explode(',', $this->query($key))))]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:120'],
            'min_price' => ['nullable', 'integer', 'min:0'],
            'max_price' => ['nullable', 'integer', 'min:0', 'gte:min_price'],
            'colors' => ['nullable', 'array', 'max:20'],
            'colors.*' => ['string', 'max:40'],
            'sizes' => ['nullable', 'array', 'max:20'],
            'sizes.*' => ['string', 'max:20'],
            'styles' => ['nullable', 'array', 'max:10'],
            'styles.*' => ['string', 'max:30'],
            'in_stock' => ['nullable', 'boolean'],
            'featured' => ['nullable', 'boolean'],
            'on_sale' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(array_keys(ProductSearch::SORTS))],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:48'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
