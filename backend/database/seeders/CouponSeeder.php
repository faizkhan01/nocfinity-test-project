<?php

namespace Database\Seeders;

use App\Enums\CouponType;
use App\Models\Coupon;
use Illuminate\Database\Seeder;

class CouponSeeder extends Seeder
{
    public function run(): void
    {
        Coupon::create([
            'code' => 'WELCOME20', 'description' => '20% off your order (max $100 off)', 'type' => CouponType::Percentage,
            'value' => 20, 'max_discount_cents' => 10000, 'per_user_limit' => 1, 'is_active' => true,
            'starts_at' => now()->subMonth(), 'expires_at' => now()->addYear(),
        ]);

        Coupon::create([
            'code' => 'SAVE15', 'description' => '$15 off orders over $100', 'type' => CouponType::Fixed,
            'value' => 1500, 'min_order_cents' => 10000, 'usage_limit' => 500, 'is_active' => true,
            'starts_at' => now()->subWeek(), 'expires_at' => now()->addMonths(3),
        ]);

        Coupon::create([
            'code' => 'FLASH50', 'description' => 'Flash sale: 50% off, first 5 orders only', 'type' => CouponType::Percentage,
            'value' => 50, 'usage_limit' => 5, 'is_active' => true, 'expires_at' => now()->addDays(2),
        ]);

        Coupon::create([
            'code' => 'SUMMER10', 'description' => 'Expired summer promotion', 'type' => CouponType::Percentage,
            'value' => 10, 'is_active' => true, 'starts_at' => now()->subMonths(4), 'expires_at' => now()->subMonth(),
        ]);
    }
}
