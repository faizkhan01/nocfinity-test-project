<?php

use App\Models\Customer;
use App\Models\Staff;

return [

    'defaults' => [
        'guard' => 'customer',
        'passwords' => 'customers',
    ],

    // Two Sanctum guards over one users table: a token only authenticates against the guard of its model.
    'guards' => [
        'customer' => [
            'driver' => 'sanctum',
            'provider' => 'customers',
        ],
        'admin' => [
            'driver' => 'sanctum',
            'provider' => 'staff',
        ],
    ],

    'providers' => [
        'customers' => [
            'driver' => 'eloquent',
            'model' => Customer::class,
        ],
        'staff' => [
            'driver' => 'eloquent',
            'model' => Staff::class,
        ],
    ],

    'passwords' => [
        'customers' => [
            'provider' => 'customers',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
        'staff' => [
            'provider' => 'staff',
            'table' => 'password_reset_tokens',
            'expire' => 30,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => 10800,

];
