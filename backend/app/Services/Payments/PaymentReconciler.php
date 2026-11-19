<?php

namespace App\Services\Payments;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Services\Orders\OrderLifecycle;
use App\Services\Orders\PaymentService;

/**
 * Settles a pending order from its payment's real state at Stripe. This covers a customer who closed the
 * browser after authorizing (with webhooks off or delayed), and it never voids a payment that went through.
 */
class PaymentReconciler
{
    public const FINALIZED = 'finalized';

    public const CANCELLED = 'cancelled';

    public const EXPIRED = 'expired';

    public const WAITING = 'waiting';

    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly PaymentService $payments,
        private readonly OrderLifecycle $lifecycle,
    ) {}

    /** @return string what happened: finalized, cancelled, expired, waiting, or "rejected:<code>" when finalizing refused the order */
    public function reconcile(Order $order): string
    {
        if ($order->status !== OrderStatus::Pending) {
            return self::WAITING;
        }

        $payment = $order->latestPayment()->first();
        $intent = $payment?->provider_payment_id ? $this->gateway->retrieve($payment->provider_payment_id) : null;

        if ($intent && ($intent->isAuthorized() || $intent->isCaptured())) {
            try {
                $this->payments->finalize($order);

                return self::FINALIZED;
            } catch (ApiException $e) {
                // Sold out, coupon used up or a mismatch: finalize has already cancelled and voided it.
                return "rejected:{$e->errorCode}";
            }
        }

        if ($intent?->isCancelled()) {
            $this->lifecycle->cancel($order, 'Payment was cancelled', notify: false, onlyFrom: OrderStatus::Pending);

            return self::CANCELLED;
        }

        // A payment Stripe is still processing is never voided; it settles on a later run.
        $expired = $order->created_at->lt(now()->subMinutes((int) config('shop.pending_order_ttl_minutes')));
        if ($expired && $intent?->status !== 'processing') {
            $this->lifecycle->cancel($order, 'Payment was not completed in time', notify: false, onlyFrom: OrderStatus::Pending);

            return self::EXPIRED;
        }

        return self::WAITING;
    }
}
