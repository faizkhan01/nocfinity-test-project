<?php

namespace App\Services\Payments;

use App\Models\Order;

interface PaymentGateway
{
    /** Card-only intent with manual capture, so funds are only taken once stock is secured. */
    public function createIntent(Order $order): PaymentIntentData;

    public function retrieve(string $intentId): PaymentIntentData;

    public function capture(string $intentId): PaymentIntentData;

    public function cancel(string $intentId): void;

    public function refund(string $intentId): void;
}
