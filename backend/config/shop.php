<?php

return [
    'currency' => env('STRIPE_CURRENCY', 'usd'),

    'shipping_flat_cents' => (int) env('SHOP_SHIPPING_FLAT_CENTS', 1500),

    // Orders at or above this subtotal ship free; null disables free shipping.
    'free_shipping_min_cents' => env('SHOP_FREE_SHIPPING_MIN_CENTS') !== null ? (int) env('SHOP_FREE_SHIPPING_MIN_CENTS') : null,

    'max_quantity_per_item' => 20,

    // Unpaid orders older than this are cancelled and their payment intents voided.
    'pending_order_ttl_minutes' => (int) env('SHOP_PENDING_ORDER_TTL', 60),

    'guest_cart_ttl_days' => 30,
];
