<?php

namespace App\Support;

/** Single source of truth for permission names; seeded into the permissions table. */
final class PermissionRegistry
{
    public const ALL = [
        'dashboard' => [
            'dashboard.view' => 'View the dashboard',
            'reports.view' => 'View revenue and sales reports',
        ],
        'products' => [
            'products.view' => 'View products',
            'products.create' => 'Create products',
            'products.edit' => 'Edit products, prices and stock',
            'products.delete' => 'Delete products',
        ],
        'categories' => [
            'categories.view' => 'View categories',
            'categories.manage' => 'Create, edit and delete categories',
        ],
        'orders' => [
            'orders.view' => 'View orders',
            'orders.update_status' => 'Update order status and cancel orders',
        ],
        'coupons' => [
            'coupons.view' => 'View coupons',
            'coupons.manage' => 'Create, edit and delete coupons',
        ],
        'customers' => [
            'customers.view' => 'View customers and their orders',
        ],
        'reviews' => [
            'reviews.manage' => 'Moderate product reviews',
        ],
        'staff' => [
            'staff.view' => 'View staff accounts',
            'staff.manage' => 'Create, edit and deactivate staff accounts',
        ],
        'roles' => [
            'roles.view' => 'View roles and permissions',
            'roles.manage' => 'Create and edit roles and their permissions',
        ],
        'activity' => [
            'activity_logs.view' => 'View the admin activity log',
        ],
    ];

    /** @return list<string> */
    public static function names(): array
    {
        return array_merge(...array_map('array_keys', array_values(self::ALL)));
    }
}
