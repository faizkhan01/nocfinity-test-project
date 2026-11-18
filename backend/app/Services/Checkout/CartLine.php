<?php

namespace App\Services\Checkout;

use App\Models\CartItem;
use App\Models\Product;

final class CartLine
{
    public function __construct(
        public readonly CartItem $item,
        public readonly Product $product,
        public readonly int $unitPriceCents,
        public readonly int $lineTotalCents,
        public readonly ?string $issue,
    ) {}

    public function isAvailable(): bool
    {
        return $this->issue === null;
    }
}
