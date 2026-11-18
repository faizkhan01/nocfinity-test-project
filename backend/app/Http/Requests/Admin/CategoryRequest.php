<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CategoryRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'parent_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->whereNull('parent_id')],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    /** Categories are two levels deep: a parent cannot itself have a parent, and a parent cannot become a child. */
    public function after(): array
    {
        return [function (Validator $validator) {
            /** @var Category|null $category */
            $category = $this->route('category');

            if ($category && $this->input('parent_id') && (int) $this->input('parent_id') === $category->id) {
                $validator->errors()->add('parent_id', 'A category cannot be its own parent.');
            }

            if ($category && $this->input('parent_id') && $category->children()->exists()) {
                $validator->errors()->add('parent_id', 'A category with subcategories cannot be moved under another category.');
            }
        }];
    }
}
