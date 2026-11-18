<?php

namespace App\Http\Resources;

use App\Models\Cart;
use App\Services\Checkout\CartLine;
use App\Services\Checkout\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    public function __construct(private readonly ?Cart $cart, private readonly ?Quote $quote)
    {
        parent::__construct($cart);
    }

    public function toArray(Request $request): array
    {
        $quote = $this->quote;

        return [
            'token' => $this->cart?->user_id === null ? $this->cart?->token : null,
            'items' => array_map(fn (CartLine $line) => [
                'id' => $line->item->id,
                'product' => [
                    'id' => $line->product->id,
                    'name' => $line->product->name,
                    'slug' => $line->product->slug,
                    'image' => $line->product->primaryImage?->url(),
                    'stock' => max($line->product->stock, 0),
                ],
                'color' => $line->item->color ?: null,
                'size' => $line->item->size ?: null,
                'quantity' => $line->item->quantity,
                'unit_price_cents' => $line->unitPriceCents,
                'original_price_cents' => $line->product->price_cents,
                'line_total_cents' => $line->lineTotalCents,
                'issue' => $line->issue,
            ], $quote?->lines ?? []),
            'coupon' => $quote?->coupon ? [
                'code' => $quote->coupon->code,
                'type' => $quote->coupon->type->value,
                'value' => $quote->coupon->value,
                'error' => $quote->couponError,
            ] : null,
            'item_count' => $quote?->itemCount() ?? 0,
            'subtotal_cents' => $quote?->subtotalCents ?? 0,
            'discount_cents' => $quote?->discountCents ?? 0,
            'shipping_cents' => $quote?->shippingCents ?? 0,
            'total_cents' => $quote?->totalCents ?? 0,
            'currency' => $quote?->currency ?? config('shop.currency'),
            'has_issues' => $quote?->hasIssues() ?? false,
        ];
    }
}
