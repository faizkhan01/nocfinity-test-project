<?php

namespace App\Services\Checkout;

use App\Exceptions\ApiException;
use App\Exceptions\InsufficientStockException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Customer;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CartService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly CouponService $coupons,
    ) {}

    /** The customer's cart, or the guest cart for the token; created on demand. */
    public function resolve(?Customer $customer, ?string $guestToken, bool $create = false): ?Cart
    {
        if ($customer) {
            return $create
                ? Cart::firstOrCreate(['user_id' => $customer->id])
                : Cart::where('user_id', $customer->id)->first();
        }

        $cart = Str::isUuid((string) $guestToken)
            ? Cart::whereNull('user_id')->where('token', $guestToken)->first()
            : null;

        return $cart ?? ($create ? Cart::create(['token' => (string) Str::uuid()]) : null);
    }

    public function addItem(Cart $cart, int $productId, int $quantity, ?string $color, ?string $size): void
    {
        DB::transaction(function () use ($cart, $productId, $quantity, $color, $size) {
            Cart::whereKey($cart->id)->lockForUpdate()->first();
            $product = Product::active()->find($productId);

            if (! $product) {
                throw new ApiException('This product is not available.', 'product_unavailable', 404);
            }

            [$color, $size] = $this->assertOptions($product, $color, $size);

            $item = $cart->items()->firstOrNew(['product_id' => $product->id, 'color' => $color ?? '', 'size' => $size ?? '']);
            $item->quantity = $this->checkedQuantity($product, ($item->exists ? $item->quantity : 0) + $quantity);
            $item->save();
            $cart->touch();
        });
    }

    public function updateItem(Cart $cart, int $itemId, int $quantity): void
    {
        $item = $cart->items()->with('product')->findOrFail($itemId);

        if (! $item->product->is_active || $item->product->trashed()) {
            throw new ApiException('This product is no longer available. Please remove it from your cart.', 'product_unavailable', 409);
        }

        $item->update(['quantity' => $this->checkedQuantity($item->product, $quantity)]);
        $cart->touch();
    }

    public function removeItem(Cart $cart, int $itemId): void
    {
        $cart->items()->findOrFail($itemId)->delete();
        $cart->touch();
    }

    public function applyCoupon(Cart $cart, string $code, ?Customer $customer): void
    {
        $coupon = $this->coupons->findByCode($code);
        $this->coupons->assertUsable($coupon, $this->pricing->quote($cart, $customer)->subtotalCents, $customer);

        $cart->coupon()->associate($coupon)->save();
    }

    public function removeCoupon(Cart $cart): void
    {
        $cart->coupon()->dissociate()->save();
    }

    /** Move a guest cart's lines into the customer's cart, capping each line at available stock. */
    public function mergeGuestCart(Customer $customer, ?string $guestToken): void
    {
        $guest = $this->resolve(null, $guestToken);

        if (! $guest) {
            return;
        }

        DB::transaction(function () use ($customer, $guest) {
            $cart = Cart::firstOrCreate(['user_id' => $customer->id]);

            foreach ($guest->items()->with('product')->get() as $line) {
                $product = $line->product;

                if (! $product->is_active || $product->trashed() || $product->stock === 0) {
                    continue;
                }

                $item = $cart->items()->firstOrNew(['product_id' => $product->id, 'color' => $line->color, 'size' => $line->size]);
                $item->quantity = min(($item->exists ? $item->quantity : 0) + $line->quantity, $product->stock, (int) config('shop.max_quantity_per_item'));
                $item->save();
            }

            if (! $cart->coupon_id && $guest->coupon_id) {
                $cart->coupon_id = $guest->coupon_id;
            }

            $cart->touch();
            $cart->save();
            $guest->delete();
        });
    }

    public function clear(Cart $cart): void
    {
        $cart->items()->delete();
        $cart->coupon()->dissociate()->save();
    }

    /** @return array{0: ?string, 1: ?string} */
    private function assertOptions(Product $product, ?string $color, ?string $size): array
    {
        $errors = [];

        if (! empty($product->colors) && ! $product->hasColor($color)) {
            $errors['color'] = ['Please choose an available colour.'];
        }

        if (! empty($product->sizes) && ! $product->hasSize($size)) {
            $errors['size'] = ['Please choose an available size.'];
        }

        if ($errors) {
            throw new ApiException('Please choose the product options.', 'invalid_options', 422, $errors);
        }

        return [empty($product->colors) ? null : $color, empty($product->sizes) ? null : $size];
    }

    private function checkedQuantity(Product $product, int $quantity): int
    {
        if ($product->stock === 0) {
            throw new InsufficientStockException('This product is out of stock.');
        }

        if ($quantity > $product->stock) {
            throw new InsufficientStockException("Only {$product->stock} of this product left in stock.", [
                'quantity' => ["Only {$product->stock} left in stock."],
            ]);
        }

        $max = (int) config('shop.max_quantity_per_item');

        if ($quantity > $max) {
            throw new ApiException("You can order at most {$max} of a single item.", 'quantity_limit', 422, [
                'quantity' => ["Maximum {$max} per item."],
            ]);
        }

        return $quantity;
    }
}
