<?php

namespace App\Services\Payments;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\Payment;
use App\Models\StripeEvent;
use App\Services\Orders\OrderLifecycle;
use App\Services\Orders\PaymentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Event;
use Throwable;

/** Processes each Stripe event once, records the outcome, and lets Stripe retry only real failures. */
class StripeWebhookHandler
{
    public const DUPLICATE = 'duplicate';

    /** A claim older than this is treated as abandoned (the process died), so a retry may take it over. */
    private const CLAIM_TIMEOUT_MINUTES = 5;

    public function __construct(
        private readonly PaymentService $payments,
        private readonly OrderLifecycle $lifecycle,
    ) {}

    /** @return string the outcome, or "duplicate" when the event was already handled or is being handled */
    public function handle(Event $event): string
    {
        $intent = $event->data->object;
        $intentId = ($intent->object ?? null) === 'payment_intent' ? $intent->id : null;

        StripeEvent::insertOrIgnore([
            'id' => $event->id,
            'type' => $event->type,
            'payment_intent_id' => $intentId,
            'livemode' => (bool) $event->livemode,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Atomic claim: only one delivery of an event runs, even if Stripe sends it twice at once.
        $claimed = StripeEvent::whereKey($event->id)
            ->whereNull('processed_at')
            ->where(fn ($q) => $q->whereNull('claimed_at')->orWhere('claimed_at', '<', now()->subMinutes(self::CLAIM_TIMEOUT_MINUTES)))
            ->update(['claimed_at' => now(), 'attempts' => DB::raw('attempts + 1'), 'updated_at' => now()]);

        if ($claimed === 0) {
            return self::DUPLICATE;
        }

        try {
            $outcome = $this->process($event->type, $intentId, $intent);
        } catch (Throwable $e) {
            StripeEvent::whereKey($event->id)->update(['claimed_at' => null, 'outcome' => 'error', 'updated_at' => now()]);
            throw $e;
        }

        StripeEvent::whereKey($event->id)->update(['processed_at' => now(), 'claimed_at' => null, 'outcome' => $outcome, 'updated_at' => now()]);

        return $outcome;
    }

    private function process(string $type, ?string $intentId, object $intent): string
    {
        $payment = $intentId ? Payment::with('order')->where('provider_payment_id', $intentId)->first() : null;

        if (! $payment) {
            return 'ignored';
        }

        try {
            return match ($type) {
                'payment_intent.amount_capturable_updated', 'payment_intent.succeeded' => tap('finalized', fn () => $this->payments->finalize($payment->order)),
                'payment_intent.payment_failed' => tap('failure_recorded', fn () => $this->payments->recordFailure($payment, $intent->last_payment_error->message ?? null)),
                'payment_intent.canceled' => $payment->order->status === OrderStatus::Pending
                    ? tap('cancelled', fn () => $this->lifecycle->cancel($payment->order, 'Payment was cancelled', notify: false, onlyFrom: OrderStatus::Pending))
                    : 'ignored',
                default => 'ignored',
            };
        } catch (ApiException $e) {
            // Business outcomes (sold out, already voided) are final, so Stripe must not retry them.
            Log::info('Stripe webhook handled with a business error', ['intent' => $intentId, 'code' => $e->errorCode]);

            return "rejected:{$e->errorCode}";
        }
    }
}
