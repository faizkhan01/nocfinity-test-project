<?php

namespace App\Services\Orders;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\ApiException;
use App\Exceptions\InsufficientStockException;
use App\Models\Customer;
use App\Models\Order;
use App\Services\Checkout\CartLine;
use App\Services\Checkout\CartService;
use App\Services\Checkout\CouponService;
use App\Services\Checkout\PricingService;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentIntentData;
use Illuminate\Support\Facades\DB;
use Throwable;

class CheckoutService
{
    public function __construct(
        private readonly CartService $carts,
        private readonly PricingService $pricing,
        private readonly CouponService $coupons,
        private readonly PaymentGateway $gateway,
        private readonly OrderLifecycle $lifecycle,
    ) {}

    /**
     * Turn the customer's cart into a pending order priced entirely on the server, and open a payment intent for it.
     *
     * @param  array<string, string|null>  $shipping
     * @return array{order: Order, intent: PaymentIntentData}
     */
    public function start(Customer $customer, array $shipping, ?string $notes): array
    {
        $cart = $this->carts->resolve($customer, null);
        $quote = $cart ? $this->pricing->quote($cart, $customer) : null;

        if (! $quote || $quote->lines === []) {
            throw new ApiException('Your cart is empty.', 'cart_empty', 422);
        }

        if ($quote->hasIssues()) {
            $errors = [];
            foreach ($quote->lines as $line) {
                if (! $line->isAvailable()) {
                    $errors["items.{$line->product->id}"] = [$line->product->name.': '.$line->issue];
                }
            }

            throw new InsufficientStockException('Some items in your cart are unavailable. Please update your cart.', $errors);
        }

        if ($quote->coupon) {
            $this->coupons->assertUsable($quote->coupon, $quote->subtotalCents, $customer);
        }

        $this->cancelPreviousPendingOrders($customer);

        $order = DB::transaction(function () use ($customer, $quote, $shipping, $notes) {
            $order = new Order([
                'user_id' => $customer->id,
                'coupon_id' => $quote->coupon?->id,
                'coupon_code' => $quote->coupon?->code,
                'subtotal_cents' => $quote->subtotalCents,
                'discount_cents' => $quote->discountCents,
                'shipping_cents' => $quote->shippingCents,
                'total_cents' => $quote->totalCents,
                'currency' => strtoupper($quote->currency),
                'notes' => $notes,
                ...collect($shipping)->mapWithKeys(fn ($v, $k) => ["shipping_{$k}" => $v])->all(),
            ]);
            $order->status = OrderStatus::Pending;
            $order->save();
            $order->order_number = Order::numberFor($order);
            $order->save();

            $order->items()->createMany(array_map(fn (CartLine $line) => [
                'product_id' => $line->product->id,
                'product_name' => $line->product->name,
                'product_sku' => $line->product->sku,
                'image_path' => $line->product->primaryImage?->path,
                'color' => $line->item->color ?: null,
                'size' => $line->item->size ?: null,
                'unit_price_cents' => $line->unitPriceCents,
                'quantity' => $line->item->quantity,
                'line_total_cents' => $line->lineTotalCents,
            ], $quote->lines));

            $this->lifecycle->recordHistory($order, null, OrderStatus::Pending, note: 'Order placed, awaiting payment');

            return $order;
        });

        try {
            $intent = $this->gateway->createIntent($order);
        } catch (Throwable $e) {
            $this->lifecycle->cancel($order, 'Payment could not be started', notify: false);

            throw $e;
        }

        $order->payments()->create([
            'provider' => 'stripe',
            'provider_payment_id' => $intent->id,
            'status' => PaymentStatus::Pending,
            'amount_cents' => $order->total_cents,
            'currency' => $order->currency,
        ]);

        return ['order' => $order, 'intent' => $intent];
    }

    /** A customer can only have one checkout in flight; older unpaid attempts are voided. */
    private function cancelPreviousPendingOrders(Customer $customer): void
    {
        $customer->orders()->where('status', OrderStatus::Pending)->get()
            ->each(fn (Order $order) => $this->lifecycle->cancel($order, 'Superseded by a newer checkout', notify: false, onlyFrom: OrderStatus::Pending));
    }
}
