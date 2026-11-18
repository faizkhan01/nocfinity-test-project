<?php

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Orders\OrderLifecycle;
use App\Services\Orders\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;
use UnexpectedValueException;

class StripeWebhookController extends Controller
{
    public function __construct(
        private readonly PaymentService $payments,
        private readonly OrderLifecycle $lifecycle,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                (string) $request->header('Stripe-Signature'),
                (string) config('services.stripe.webhook_secret'),
            );
        } catch (SignatureVerificationException|UnexpectedValueException) {
            return response()->json(['message' => 'Invalid signature.', 'code' => 'invalid_signature'], 400);
        }

        $intent = $event->data->object;
        $payment = Payment::with('order')->where('provider_payment_id', $intent->id ?? null)->first();

        if (! $payment) {
            return response()->json(['received' => true]);
        }

        try {
            match ($event->type) {
                'payment_intent.amount_capturable_updated', 'payment_intent.succeeded' => $this->payments->finalize($payment->order),
                'payment_intent.payment_failed' => $this->payments->recordFailure($payment, $intent->last_payment_error->message ?? null),
                'payment_intent.canceled' => $payment->order->status === OrderStatus::Pending
                    ? $this->lifecycle->cancel($payment->order, 'Payment was cancelled', notify: false)
                    : null,
                default => null,
            };
        } catch (ApiException $e) {
            // Business outcomes (e.g. sold out, already voided) are final; do not make Stripe retry them.
            Log::info('Stripe webhook handled with business error', ['event' => $event->id, 'code' => $e->errorCode]);
        }

        return response()->json(['received' => true]);
    }
}
