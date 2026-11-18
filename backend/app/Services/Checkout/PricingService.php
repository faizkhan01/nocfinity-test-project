<?php

namespace App\Services\Checkout;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Customer;

class PricingService
{
    public function __construct(private readonly CouponService $coupons) {}

    public function quote(Cart $cart, ?Customer $customer = null): Quote
    {
        $cart->loadMissing(['items.product.primaryImage', 'coupon']);

        $lines = $cart->items->map(function (CartItem $item) {
            $product = $item->product;
            $unit = $product->unitPriceCents();

            return new CartLine($item, $product, $unit, $unit * $item->quantity, $this->issueFor($item));
        })->all();

        $subtotal = array_sum(array_map(
            fn (CartLine $l) => $l->isAvailable() ? $l->lineTotalCents : 0,
            $lines,
        ));

        $coupon = $cart->coupon;
        $couponError = $coupon ? $this->coupons->isUsable($coupon, $subtotal, $customer) : null;
        $discount = $coupon && ! $couponError ? $coupon->discountFor($subtotal) : 0;
        $shipping = $this->shippingFor($subtotal);

        return new Quote(
            lines: $lines,
            subtotalCents: $subtotal,
            discountCents: $discount,
            shippingCents: $shipping,
            totalCents: $subtotal - $discount + $shipping,
            currency: config('shop.currency'),
            coupon: $coupon,
            couponError: $couponError,
        );
    }

    public function shippingFor(int $subtotalCents): int
    {
        if ($subtotalCents === 0) {
            return 0;
        }

        $freeFrom = config('shop.free_shipping_min_cents');

        return $freeFrom !== null && $subtotalCents >= $freeFrom ? 0 : (int) config('shop.shipping_flat_cents');
    }

    private function issueFor(CartItem $item): ?string
    {
        $product = $item->product;

        return match (true) {
            ! $product->is_active || $product->trashed() => 'This product is no longer available.',
            $product->stock === 0 => 'This product is out of stock.',
            $product->stock < $item->quantity => "Only {$product->stock} left in stock.",
            default => null,
        };
    }
}
