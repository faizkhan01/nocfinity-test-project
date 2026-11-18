<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Processing = 'processing';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Paid, self::Cancelled],
            self::Paid => [self::Processing, self::Cancelled],
            self::Processing => [self::Shipped, self::Cancelled],
            self::Shipped => [self::Delivered],
            self::Delivered, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }

    /** Statuses staff may set by hand; "paid" is only ever set by a captured payment. */
    public function staffTransitions(): array
    {
        return array_values(array_filter($this->allowedTransitions(), fn (self $s) => $s !== self::Paid));
    }

    /** Stock was decremented for these statuses, so cancelling them must restore it. */
    public function holdsStock(): bool
    {
        return in_array($this, [self::Paid, self::Processing, self::Shipped, self::Delivered], true);
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
