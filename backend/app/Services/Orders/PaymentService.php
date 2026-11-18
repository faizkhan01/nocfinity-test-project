<?php

namespace App\Services\Orders;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\ApiException;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Checkout\CartService;
use App\Services\Checkout\CouponService;
use App\Services\Payments\PaymentGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentService
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly StockService $stock,
        private readonly CouponService $coupons,
        private readonly OrderLifecycle $lifecycle,
        private readonly CartService $carts,
    ) {}

    /**
     * Settle an order from the payment intent's real state at Stripe (never from client input).
     * Idempotent: safe to call from both the browser confirmation and the webhook.
     */
    public function finalize(Order $order): Order
    {
        $payment = $order->latestPayment()->firstOrFail();

        if ($order->status !== OrderStatus::Pending) {
            return $order;
        }

        $intent = $this->gateway->retrieve($payment->provider_payment_id);

        if ($intent->needsPaymentMethod()) {
            $this->recordFailure($payment, $intent->errorMessage);

            throw new ApiException($intent->errorMessage ?: 'Your payment was not completed. Please try again.', 'payment_failed', 402);
        }

        if ($intent->isCancelled()) {
            $this->lifecycle->cancel($order, 'Payment was cancelled', notify: false);

            throw new ApiException('This payment was cancelled. Please place your order again.', 'payment_cancelled', 409);
        }

        if (! $intent->isAuthorized() && ! $intent->isCaptured()) {
            throw new ApiException('Your payment is still processing. We will email you once it completes.', 'payment_processing', 409);
        }

        $mismatch = $intent->amountCents !== $order->total_cents
            || $intent->currency !== strtolower($order->currency)
            || $intent->orderId !== $order->id
            || ($intent->isAuthorized() && $intent->paymentMethodType !== 'card');

        if ($mismatch) {
            Log::alert('Payment intent does not match order', ['order_id' => $order->id, 'intent' => $intent->id]);
            $this->lifecycle->cancel($order, 'Payment amount mismatch', notify: false);

            throw new ApiException('The payment did not match this order and has been voided.', 'payment_mismatch', 409);
        }

        try {
            $order = DB::transaction(function () use ($order, $payment, $intent) {
                $order = Order::with('items')->whereKey($order->id)->lockForUpdate()->firstOrFail();

                if ($order->status !== OrderStatus::Pending) {
                    return $order;
                }

                $this->stock->decrementFor($order);
                $this->redeemCoupon($order);

                // Capture last, while the stock rows are still locked: if it fails, everything above rolls back.
                if ($intent->isAuthorized()) {
                    $this->gateway->capture($intent->id);
                }

                $payment->update(['status' => PaymentStatus::Succeeded, 'captured_at' => now(), 'failure_message' => null]);
                $order->status = OrderStatus::Paid;
                $order->paid_at = now();
                $order->save();
                $this->lifecycle->recordHistory($order, OrderStatus::Pending, OrderStatus::Paid, note: 'Payment captured');

                return $order;
            });
        } catch (ApiException $e) {
            if (in_array($e->errorCode, ['insufficient_stock', 'coupon_invalid'], true)) {
                $this->lifecycle->cancel($order, $e->getMessage(), notify: false);
            }

            throw $e;
        }

        if ($order->wasChanged('status')) {
            $this->clearCart($order);
            $this->lifecycle->notifyCustomer($order);
        }

        return $order;
    }

    public function recordFailure(Payment $payment, ?string $message): void
    {
        $payment->update(['status' => PaymentStatus::Failed, 'failure_message' => $message ? mb_substr($message, 0, 255) : null]);
    }

    private function redeemCoupon(Order $order): void
    {
        if (! $order->coupon_id) {
            return;
        }

        $coupon = Coupon::whereKey($order->coupon_id)->lockForUpdate()->first();

        if (! $coupon) {
            throw new ApiException('The coupon on this order no longer exists. You have not been charged.', 'coupon_invalid', 422);
        }

        $this->coupons->assertUsable($coupon, $order->subtotal_cents, $order->customer, $order);
        $coupon->increment('used_count');
    }

    /** Remove only what was bought, so items added in another tab during payment survive. */
    private function clearCart(Order $order): void
    {
        $cart = $this->carts->resolve($order->customer, null);

        if (! $cart) {
            return;
        }

        foreach ($order->items as $item) {
            $cart->items()->where(['product_id' => $item->product_id, 'color' => $item->color ?? '', 'size' => $item->size ?? ''])->delete();
        }

        if ($cart->coupon_id === $order->coupon_id) {
            $cart->coupon()->dissociate()->save();
        }
    }
}
