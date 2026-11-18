<?php

namespace App\Services\Payments;

use App\Exceptions\ApiException;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\PaymentIntent;
use Stripe\StripeClient;

class StripeGateway implements PaymentGateway
{
    public function __construct(private readonly StripeClient $stripe) {}

    public function createIntent(Order $order): PaymentIntentData
    {
        return $this->call(fn () => $this->stripe->paymentIntents->create([
            'amount' => $order->total_cents,
            'currency' => strtolower($order->currency),
            'capture_method' => 'manual',
            'payment_method_types' => ['card'],
            'description' => "Order {$order->order_number}",
            'metadata' => ['order_id' => (string) $order->id, 'order_number' => $order->order_number],
        ], ['idempotency_key' => 'order-intent-'.$order->id]));
    }

    public function retrieve(string $intentId): PaymentIntentData
    {
        return $this->call(fn () => $this->stripe->paymentIntents->retrieve($intentId));
    }

    public function capture(string $intentId): PaymentIntentData
    {
        return $this->call(fn () => $this->stripe->paymentIntents->capture($intentId));
    }

    public function cancel(string $intentId): void
    {
        $this->call(fn () => $this->stripe->paymentIntents->cancel($intentId));
    }

    public function refund(string $intentId): void
    {
        $this->call(fn () => $this->stripe->refunds->create(['payment_intent' => $intentId]));
    }

    private function call(callable $request): PaymentIntentData
    {
        try {
            $result = $request();
        } catch (ApiErrorException $e) {
            Log::warning('Stripe request failed', ['type' => $e::class, 'code' => $e->getStripeCode(), 'message' => $e->getMessage()]);

            throw new ApiException('The payment provider is unavailable. Please try again.', 'payment_provider_error', 502);
        }

        return $result instanceof PaymentIntent ? self::toData($result) : new PaymentIntentData('', 'ok', 0, '', null);
    }

    private static function toData(PaymentIntent $intent): PaymentIntentData
    {
        return new PaymentIntentData(
            id: $intent->id,
            status: $intent->status,
            amountCents: (int) $intent->amount,
            currency: strtolower($intent->currency),
            orderId: isset($intent->metadata['order_id']) ? (int) $intent->metadata['order_id'] : null,
            clientSecret: $intent->client_secret,
            errorMessage: $intent->last_payment_error?->message,
        );
    }
}
