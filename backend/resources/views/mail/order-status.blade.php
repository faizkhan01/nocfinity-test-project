<x-mail::message>
# Hi {{ $order->customer->name }},

@switch($order->status->value)
@case('paid')
Thanks for your order! We've received your payment and will start preparing it shortly.
@break
@case('processing')
Good news: we're now preparing your order.
@break
@case('shipped')
Your order is on its way.
@break
@case('delivered')
Your order has been delivered. We hope you love it!
@break
@case('cancelled')
Your order has been cancelled.@if($order->cancellation_reason) Reason: {{ $order->cancellation_reason }}@endif

Any payment taken has been refunded to your card.
@break
@default
Your order status is now **{{ $order->status->label() }}**.
@endswitch

**Order:** {{ $order->order_number }}<br>
**Status:** {{ $order->status->label() }}

<x-mail::table>
| Item | Qty | Total |
|:-----|:---:|------:|
@foreach ($order->items as $item)
| {{ $item->product_name }}@if($item->size) ({{ $item->size }}@if($item->color), {{ $item->color }}@endif)@endif | {{ $item->quantity }} | ${{ number_format($item->line_total_cents / 100, 2) }} |
@endforeach
| | **Total** | **${{ number_format($order->total_cents / 100, 2) }}** |
</x-mail::table>

<x-mail::button :url="$url">
View your order
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
