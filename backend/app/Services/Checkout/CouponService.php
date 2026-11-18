<?php

namespace App\Services\Checkout;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;

class CouponService
{
    public function findByCode(string $code): Coupon
    {
        $coupon = Coupon::where('code', strtoupper(trim($code)))->first();

        if (! $coupon) {
            throw $this->invalid('This coupon code is not valid.');
        }

        return $coupon;
    }

    /** Throws an ApiException describing the first rule the coupon fails. */
    public function assertUsable(Coupon $coupon, int $subtotalCents, ?Customer $customer, ?Order $excludeOrder = null): void
    {
        if (! $coupon->is_active) {
            throw $this->invalid('This coupon code is not valid.');
        }

        if ($coupon->starts_at && $coupon->starts_at->isFuture()) {
            throw $this->invalid('This coupon is not active yet.');
        }

        if ($coupon->expires_at && $coupon->expires_at->isPast()) {
            throw $this->invalid('This coupon has expired.');
        }

        if ($coupon->usage_limit !== null && $coupon->used_count >= $coupon->usage_limit) {
            throw $this->invalid('This coupon has reached its usage limit.');
        }

        if ($subtotalCents < $coupon->min_order_cents) {
            $minimum = number_format($coupon->min_order_cents / 100, 2);
            throw $this->invalid("This coupon requires a minimum order of \${$minimum}.");
        }

        if ($customer && $coupon->per_user_limit !== null && $this->usesBy($coupon, $customer, $excludeOrder) >= $coupon->per_user_limit) {
            throw $this->invalid('You have already used this coupon the maximum number of times.');
        }
    }

    public function isUsable(Coupon $coupon, int $subtotalCents, ?Customer $customer): ?string
    {
        try {
            $this->assertUsable($coupon, $subtotalCents, $customer);

            return null;
        } catch (ApiException $e) {
            return $e->getMessage();
        }
    }

    private function usesBy(Coupon $coupon, Customer $customer, ?Order $excludeOrder): int
    {
        return Order::where('user_id', $customer->id)
            ->where('coupon_id', $coupon->id)
            ->whereNotIn('status', [OrderStatus::Pending, OrderStatus::Cancelled])
            ->when($excludeOrder, fn ($q) => $q->whereKeyNot($excludeOrder->id))
            ->count();
    }

    private function invalid(string $message): ApiException
    {
        return new ApiException($message, 'coupon_invalid', 422, ['coupon' => [$message]]);
    }
}
