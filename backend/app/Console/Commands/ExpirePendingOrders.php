<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Services\Orders\OrderLifecycle;
use Illuminate\Console\Command;
use Throwable;

class ExpirePendingOrders extends Command
{
    protected $signature = 'orders:expire-pending';

    protected $description = 'Cancel unpaid orders older than the configured TTL and void their payment intents.';

    public function handle(OrderLifecycle $lifecycle): int
    {
        $cutoff = now()->subMinutes((int) config('shop.pending_order_ttl_minutes'));
        $expired = 0;

        Order::where('status', OrderStatus::Pending)->where('created_at', '<', $cutoff)->orderBy('id')
            ->each(function (Order $order) use ($lifecycle, &$expired) {
                try {
                    $lifecycle->cancel($order, 'Payment was not completed in time', notify: false);
                    $expired++;
                } catch (Throwable $e) {
                    report($e);
                }
            });

        $this->info("Expired {$expired} pending order(s).");

        return self::SUCCESS;
    }
}
