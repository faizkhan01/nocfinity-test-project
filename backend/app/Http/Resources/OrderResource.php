<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isAdmin = $request->is('api/v1/admin/*');

        return [
            'id' => $this->when($isAdmin, $this->id),
            'order_number' => $this->order_number,
            'status' => $this->status->value,
            'subtotal_cents' => $this->subtotal_cents,
            'discount_cents' => $this->discount_cents,
            'shipping_cents' => $this->shipping_cents,
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            'coupon_code' => $this->coupon_code,
            'item_count' => $this->whenLoaded('items', fn () => $this->items->sum('quantity'), $this->items_count ?? null),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn (OrderItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_slug' => $item->product?->slug,
                'name' => $item->product_name,
                'sku' => $item->product_sku,
                'image' => $item->image_path ? Storage::disk('public')->url($item->image_path) : null,
                'color' => $item->color,
                'size' => $item->size,
                'unit_price_cents' => $item->unit_price_cents,
                'quantity' => $item->quantity,
                'line_total_cents' => $item->line_total_cents,
            ])),
            'shipping' => [
                'name' => $this->shipping_name,
                'phone' => $this->shipping_phone,
                'line1' => $this->shipping_line1,
                'line2' => $this->shipping_line2,
                'city' => $this->shipping_city,
                'state' => $this->shipping_state,
                'postal_code' => $this->shipping_postal_code,
                'country' => $this->shipping_country,
            ],
            'notes' => $this->notes,
            'cancellation_reason' => $this->cancellation_reason,
            'payment' => $this->whenLoaded('latestPayment', fn () => $this->latestPayment ? [
                'status' => $this->latestPayment->status->value,
                'failure_message' => $this->latestPayment->failure_message,
                'reference' => $this->when($isAdmin, $this->latestPayment->provider_payment_id),
            ] : null),
            'customer' => $this->when($isAdmin && $this->relationLoaded('customer'), fn () => $this->customer?->only('id', 'name', 'email', 'phone')),
            'history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn (OrderStatusHistory $h) => [
                'from' => $h->from_status?->value,
                'to' => $h->to_status->value,
                'note' => $h->note,
                'by' => $isAdmin ? $h->changedBy?->name : null,
                'at' => $h->created_at?->toIso8601String(),
            ])),
            'allowed_transitions' => $this->when($isAdmin, fn () => array_map(fn ($s) => $s->value, $this->status->staffTransitions())),
            'can_cancel' => $this->when(! $isAdmin, fn () => in_array($this->status->value, ['pending', 'paid'], true)),
            'placed_at' => $this->created_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'shipped_at' => $this->shipped_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
        ];
    }
}
