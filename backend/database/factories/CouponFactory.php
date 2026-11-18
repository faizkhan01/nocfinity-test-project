<?php

namespace Database\Factories;

use App\Enums\CouponType;
use App\Models\Coupon;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Coupon> */
class CouponFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => Str::upper(Str::random(8)),
            'type' => CouponType::Percentage,
            'value' => 10,
            'min_order_cents' => 0,
            'starts_at' => now()->subDay(),
            'expires_at' => now()->addMonth(),
            'is_active' => true,
        ];
    }

    public function fixed(int $cents): static
    {
        return $this->state(['type' => CouponType::Fixed, 'value' => $cents]);
    }

    public function expired(): static
    {
        return $this->state(['starts_at' => now()->subMonth(), 'expires_at' => now()->subDay()]);
    }
}
