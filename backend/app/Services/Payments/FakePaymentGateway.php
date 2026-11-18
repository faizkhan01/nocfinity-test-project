<?php

namespace App\Services\Payments;

use App\Models\Order;
use Illuminate\Support\Str;

/** In-memory gateway for automated tests; never bound outside the testing environment. */
class FakePaymentGateway implements PaymentGateway
{
    /** @var array<string, PaymentIntentData> */
    public array $intents = [];

    /** @var list<string> */
    public array $refunded = [];

    public function createIntent(Order $order): PaymentIntentData
    {
        $id = 'pi_fake_'.Str::random(12);

        return $this->intents[$id] = new PaymentIntentData(
            $id, 'requires_payment_method', $order->total_cents, strtolower($order->currency), $order->id, $id.'_secret',
        );
    }

    /** Simulate the customer confirming the card in the browser. */
    public function authorize(string $id, ?int $amountCents = null): void
    {
        $intent = $this->intents[$id];
        $this->intents[$id] = new PaymentIntentData($id, 'requires_capture', $amountCents ?? $intent->amountCents, $intent->currency, $intent->orderId, $intent->clientSecret);
    }

    public function decline(string $id, string $message = 'Your card was declined.'): void
    {
        $intent = $this->intents[$id];
        $this->intents[$id] = new PaymentIntentData($id, 'requires_payment_method', $intent->amountCents, $intent->currency, $intent->orderId, $intent->clientSecret, $message);
    }

    public function retrieve(string $intentId): PaymentIntentData
    {
        return $this->intents[$intentId];
    }

    public function capture(string $intentId): PaymentIntentData
    {
        $intent = $this->intents[$intentId];

        return $this->intents[$intentId] = new PaymentIntentData($intentId, 'succeeded', $intent->amountCents, $intent->currency, $intent->orderId);
    }

    public function cancel(string $intentId): void
    {
        $intent = $this->intents[$intentId];
        $this->intents[$intentId] = new PaymentIntentData($intentId, 'canceled', $intent->amountCents, $intent->currency, $intent->orderId);
    }

    public function refund(string $intentId): void
    {
        $this->refunded[] = $intentId;
    }
}
