<?php

namespace App\Services\Orders;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\ApiException;
use App\Mail\OrderStatusUpdated;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Staff;
use App\Services\Payments\PaymentGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class OrderLifecycle
{
    public function __construct(
        private readonly StockService $stock,
        private readonly PaymentGateway $gateway,
    ) {}

    /** Staff-driven transition (processing, shipped, delivered, cancelled); "paid" only comes from a captured payment. */
    public function transitionByStaff(Order $order, OrderStatus $to, Staff $staff, ?string $note = null): Order
    {
        if ($to === OrderStatus::Paid) {
            throw new ApiException('Orders are marked as paid automatically when the payment is captured.', 'invalid_transition', 422);
        }

        return $to === OrderStatus::Cancelled
            ? $this->cancel($order, $note ?: 'Cancelled by staff', $staff)
            : $this->transition($order, $to, $staff, $note);
    }

    public function transition(Order $order, OrderStatus $to, ?Staff $actor = null, ?string $note = null): Order
    {
        $order = DB::transaction(function () use ($order, $to, $actor, $note) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $this->assertTransition($order, $to);

            $from = $order->status;
            $order->status = $to;
            match ($to) {
                OrderStatus::Shipped => $order->shipped_at = now(),
                OrderStatus::Delivered => $order->delivered_at = now(),
                default => null,
            };
            $order->save();
            $this->recordHistory($order, $from, $to, $actor, $note);

            return $order;
        });

        $this->notifyCustomer($order);

        return $order;
    }

    /** Cancels the order, puts paid stock back, and voids or refunds the payment. */
    public function cancel(Order $order, string $reason, ?Staff $actor = null, bool $notify = true): Order
    {
        $order = DB::transaction(function () use ($order, $reason, $actor) {
            $order = Order::with('items', 'latestPayment')->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $this->assertTransition($order, OrderStatus::Cancelled);

            $from = $order->status;

            if ($from->holdsStock()) {
                $this->stock->restoreFor($order);

                if ($order->coupon_id) {
                    Coupon::whereKey($order->coupon_id)->where('used_count', '>', 0)->decrement('used_count');
                }
            }

            $this->releasePayment($order);

            $order->status = OrderStatus::Cancelled;
            $order->cancelled_at = now();
            $order->cancellation_reason = $reason;
            $order->save();
            $this->recordHistory($order, $from, OrderStatus::Cancelled, $actor, $reason);

            return $order;
        });

        if ($notify) {
            $this->notifyCustomer($order);
        }

        return $order;
    }

    public function recordHistory(Order $order, ?OrderStatus $from, OrderStatus $to, ?Staff $actor = null, ?string $note = null): void
    {
        $order->statusHistory()->create([
            'from_status' => $from?->value,
            'to_status' => $to->value,
            'changed_by' => $actor?->id,
            'note' => $note,
        ]);
    }

    public function notifyCustomer(Order $order): void
    {
        $order->loadMissing('customer');

        Mail::to($order->customer)->queue(new OrderStatusUpdated($order->id));
    }

    private function assertTransition(Order $order, OrderStatus $to): void
    {
        if (! $order->status->canTransitionTo($to)) {
            throw new ApiException(
                "An order that is {$order->status->value} cannot be changed to {$to->value}.",
                'invalid_transition',
                422,
            );
        }
    }

    private function releasePayment(Order $order): void
    {
        $payment = $order->latestPayment;

        if (! $payment) {
            return;
        }

        try {
            if ($payment->status === PaymentStatus::Succeeded) {
                $this->gateway->refund($payment->provider_payment_id);
                $payment->update(['status' => PaymentStatus::Refunded, 'refunded_at' => now()]);
            } elseif (in_array($payment->status, [PaymentStatus::Pending, PaymentStatus::Authorized, PaymentStatus::Failed], true)) {
                $this->gateway->cancel($payment->provider_payment_id);
                $payment->update(['status' => PaymentStatus::Cancelled]);
            }
        } catch (Throwable $e) {
            // A captured payment that cannot be refunded must block the cancellation.
            if ($payment->status === PaymentStatus::Succeeded) {
                throw $e;
            }

            Log::warning('Could not void payment intent while cancelling order', ['order_id' => $order->id, 'error' => $e->getMessage()]);
            $payment->update(['status' => PaymentStatus::Cancelled]);
        }
    }
}
