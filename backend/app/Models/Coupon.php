<?php

namespace App\Models;

use App\Enums\CouponType;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'description', 'type', 'value', 'min_order_cents', 'max_discount_cents',
        'usage_limit', 'per_user_limit', 'starts_at', 'expires_at', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'type' => CouponType::class,
            'value' => 'integer',
            'min_order_cents' => 'integer',
            'max_discount_cents' => 'integer',
            'usage_limit' => 'integer',
            'per_user_limit' => 'integer',
            'used_count' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    protected function code(): Attribute
    {
        return Attribute::set(fn (string $value) => strtoupper(trim($value)));
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** Discount for a given subtotal, never more than the subtotal itself. */
    public function discountFor(int $subtotalCents): int
    {
        $discount = $this->type === CouponType::Percentage
            ? intdiv($subtotalCents * $this->value, 100)
            : $this->value;

        if ($this->max_discount_cents !== null) {
            $discount = min($discount, $this->max_discount_cents);
        }

        return min($discount, $subtotalCents);
    }
}
