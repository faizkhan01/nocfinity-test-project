<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('orders:expire-pending')->everyTenMinutes()->withoutOverlapping();
Schedule::command('carts:prune-guests')->daily();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
