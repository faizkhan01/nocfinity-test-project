<?php

namespace App\Services\Checkout;

use App\Models\Coupon;

/** Server-computed totals for a cart; the only figures checkout and Stripe ever use. */
final class Quote
{
    /** @param list<CartLine> $lines */
    public function __construct(
        public readonly array $lines,
        public readonly int $subtotalCents,
        public readonly int $discountCents,
        public readonly int $shippingCents,
        public readonly int $totalCents,
        public readonly string $currency,
        public readonly ?Coupon $coupon,
        public readonly ?string $couponError,
    ) {}

    public function hasIssues(): bool
    {
        foreach ($this->lines as $line) {
            if (! $line->isAvailable()) {
                return true;
            }
        }

        return false;
    }

    public function itemCount(): int
    {
        return array_sum(array_map(fn (CartLine $l) => $l->item->quantity, $this->lines));
    }
}
