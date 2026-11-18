<?php

namespace App\Console\Commands;

use App\Models\Cart;
use Illuminate\Console\Command;

class PruneGuestCarts extends Command
{
    protected $signature = 'carts:prune-guests';

    protected $description = 'Delete guest carts that have not been touched for the configured number of days.';

    public function handle(): int
    {
        $deleted = Cart::whereNull('user_id')
            ->where('updated_at', '<', now()->subDays((int) config('shop.guest_cart_ttl_days')))
            ->delete();

        $this->info("Deleted {$deleted} guest cart(s).");

        return self::SUCCESS;
    }
}
