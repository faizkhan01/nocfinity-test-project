<?php

namespace App\Services\Payments;

final class PaymentIntentData
{
    public function __construct(
        public readonly string $id,
        public readonly string $status,
        public readonly int $amountCents,
        public readonly string $currency,
        public readonly ?int $orderId,
        public readonly ?string $clientSecret = null,
        public readonly ?string $errorMessage = null,
    ) {}

    public function isAuthorized(): bool
    {
        return $this->status === 'requires_capture';
    }

    public function isCaptured(): bool
    {
        return $this->status === 'succeeded';
    }

    public function isCancelled(): bool
    {
        return $this->status === 'canceled';
    }

    public function needsPaymentMethod(): bool
    {
        return in_array($this->status, ['requires_payment_method', 'requires_confirmation', 'requires_action'], true);
    }
}
