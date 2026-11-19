<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Services\Payments\PaymentReconciler;
use Illuminate\Console\Command;
use Throwable;

class ReconcilePayments extends Command
{
    protected $signature = 'payments:reconcile {--limit=200 : Most orders to check in one run}';

    protected $description = 'Settle pending orders from their payment state at Stripe: finalize authorized payments, cancel voided or expired ones.';

    public function handle(PaymentReconciler $reconciler): int
    {
        $cutoff = now()->subMinutes((int) config('shop.reconcile_after_minutes'));
        $outcomes = [];

        Order::where('status', OrderStatus::Pending)->where('created_at', '<', $cutoff)
            ->orderBy('id')->limit((int) $this->option('limit'))->get()
            ->each(function (Order $order) use ($reconciler, &$outcomes) {
                try {
                    $outcome = $reconciler->reconcile($order);
                } catch (Throwable $e) {
                    report($e);
                    $outcome = 'error';
                }
                $outcomes[$outcome] = ($outcomes[$outcome] ?? 0) + 1;

                if ($outcome !== PaymentReconciler::WAITING) {
                    $this->line("{$order->order_number}: {$outcome}");
                }
            });

        ksort($outcomes);
        $this->info('Checked '.array_sum($outcomes).' pending order(s)'.($outcomes ? ': '.collect($outcomes)->map(fn ($n, $k) => "{$k} {$n}")->implode(', ') : '').'.');

        return self::SUCCESS;
    }
}
