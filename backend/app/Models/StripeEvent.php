<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;

/** A received Stripe webhook event, keyed by Stripe's event ID. */
class StripeEvent extends Model
{
    use MassPrunable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'livemode' => 'boolean',
            'attempts' => 'integer',
            'claimed_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }

    /** Stripe stops retrying after three days; processed events are kept a while longer for support questions. */
    public function prunable(): Builder
    {
        return static::where('processed_at', '<', now()->subDays((int) config('shop.stripe_event_retention_days')));
    }
}
