<?php

namespace App\Http\Requests\Admin;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ProductRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'sku' => strtoupper(trim((string) $this->input('sku'))),
            'discount_price_cents' => $this->input('discount_price_cents') === '' ? null : $this->input('discount_price_cents'),
        ]);
    }

    public function rules(): array
    {
        /** @var Product|null $product */
        $product = $this->route('product');
        $maxImages = 8 - ($product ? $product->images()->count() - count((array) $this->input('remove_image_ids', [])) : 0);

        return [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'sku' => ['required', 'string', 'max:64', 'regex:/^[A-Z0-9\-_]+$/', Rule::unique('products', 'sku')->ignore($product)],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')],
            'short_description' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:10000'],
            'price_cents' => ['required', 'integer', 'min:1', 'max:100000000'],
            'discount_price_cents' => ['nullable', 'integer', 'min:1', 'lt:price_cents'],
            'stock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'colors' => ['nullable', 'array', 'max:12'],
            'colors.*.name' => ['required', 'string', 'max:40', 'distinct'],
            'colors.*.hex' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'sizes' => ['nullable', 'array', 'max:12'],
            'sizes.*' => ['string', 'max:20', 'distinct'],
            'style' => ['nullable', 'string', 'max:30', 'alpha_dash'],
            'is_active' => ['required', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'images' => ['nullable', 'array', 'max:'.max($maxImages, 0)],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120', 'dimensions:min_width=200,min_height=200,max_width=5000,max_height=5000'],
            'remove_image_ids' => ['nullable', 'array'],
            'remove_image_ids.*' => ['integer'],
        ];
    }

    public function attributes(): array
    {
        return [
            'price_cents' => 'price',
            'discount_price_cents' => 'discount price',
            'category_id' => 'category',
            'colors.*.name' => 'colour name',
            'colors.*.hex' => 'colour code',
            'images.*' => 'image',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $product = $this->route('product');
            $remaining = $product ? $product->images()->whereNotIn('id', (array) $this->input('remove_image_ids', []))->count() : 0;

            if ($remaining + count($this->file('images', [])) === 0) {
                $validator->errors()->add('images', 'Add at least one product image.');
            }
        }];
    }

    /** @return array<string, mixed> */
    public function productData(): array
    {
        $data = collect($this->validated())->except(['images', 'remove_image_ids'])->all();
        $data['colors'] = array_values($data['colors'] ?? []);
        $data['sizes'] = array_values($data['sizes'] ?? []);
        $data['low_stock_threshold'] ??= 5;
        $data['is_featured'] ??= false;

        return $data;
    }
}
