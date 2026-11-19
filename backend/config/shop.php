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

    // The Super Admin account created by the seeders.
    'super_admin' => [
        'email' => env('SUPER_ADMIN_EMAIL', 'superadmin@nocfinity-shop.test'),
        'password' => env('SUPER_ADMIN_PASSWORD', 'SuperAdmin@123'),
    ],

    // Requests per minute per user or visitor IP. Raised only for automated end-to-end runs, where one IP does everything.
    'rate_limits' => [
        'api' => (int) env('RATE_LIMIT_API', 120),
        'auth' => (int) env('RATE_LIMIT_AUTH', 10),
        'checkout' => (int) env('RATE_LIMIT_CHECKOUT', 10),
    ],

    // Display order of colour swatches in the storefront filters (matches the design palette).
    'color_order' => ['Green', 'Red', 'Yellow', 'Orange', 'Cyan', 'Blue', 'Purple', 'Pink', 'White', 'Black'],

    // Words treated as the same thing by the built-in product search.
    'search_synonyms' => [
        ['tee', 'tshirt'],
        ['jean', 'denim'],
        ['trouser', 'pant'],
        ['hoodie', 'hoody', 'sweatshirt'],
        ['sneaker', 'trainer'],
    ],
];
