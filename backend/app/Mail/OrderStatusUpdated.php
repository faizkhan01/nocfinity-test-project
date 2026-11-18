<?php

namespace App\Mail;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdated extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    private ?Order $loaded = null;

    public function __construct(public int $orderId)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        $order = $this->order();

        return new Envelope(subject: match ($order->status) {
            OrderStatus::Paid => "Order confirmed: {$order->order_number}",
            OrderStatus::Cancelled => "Order cancelled: {$order->order_number}",
            default => "Your order {$order->order_number} is now {$order->status->value}",
        });
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.order-status', with: [
            'order' => $this->order(),
            'url' => config('app.frontend_url').'/orders/'.$this->order()->order_number,
        ]);
    }

    /** Loaded at send time so the email always reflects the order's current status. */
    private function order(): Order
    {
        return $this->loaded ??= Order::with('items', 'customer')->findOrFail($this->orderId);
    }
}
