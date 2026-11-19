<?php

use Illuminate\Support\Facades\Schedule;

// Finalizes payments the browser never confirmed and expires unpaid orders, from Stripe's own state.
Schedule::command('payments:reconcile')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('model:prune')->daily();
Schedule::command('carts:prune-guests')->daily();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
