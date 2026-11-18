<?php

namespace App\Http\Requests\Admin;

use App\Enums\CouponType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CouponRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['code' => strtoupper(trim((string) $this->input('code')))]);
    }

    public function rules(): array
    {
        $isPercentage = $this->input('type') === CouponType::Percentage->value;

        return [
            'code' => ['required', 'string', 'min:3', 'max:40', 'regex:/^[A-Z0-9\-_]+$/', Rule::unique('coupons', 'code')->ignore($this->route('coupon'))],
            'description' => ['nullable', 'string', 'max:255'],
            'type' => ['required', Rule::enum(CouponType::class)],
            'value' => ['required', 'integer', 'min:1', $isPercentage ? 'max:100' : 'max:100000000'],
            'min_order_cents' => ['nullable', 'integer', 'min:0'],
            'max_discount_cents' => ['nullable', 'integer', 'min:1'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'per_user_limit' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['required', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'min_order_cents' => 'minimum order',
            'max_discount_cents' => 'maximum discount',
            'expires_at' => 'expiry date',
            'starts_at' => 'start date',
        ];
    }
}
