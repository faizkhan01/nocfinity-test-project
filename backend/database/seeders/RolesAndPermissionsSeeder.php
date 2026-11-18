<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Support\PermissionRegistry;
use Illuminate\Database\Seeder;

class RolesAndPermissionsSeeder extends Seeder
{
    /** Built-in roles; super-admin gets no rows because Gate::before grants it everything. */
    private const ROLES = [
        Staff::SUPER_ADMIN => ['Super Admin', 'Full access to everything, including roles and staff.', []],
        'admin' => ['Admin', 'Runs the store day to day. Cannot change roles.', ['*', '!roles.manage']],
        'product-manager' => ['Product Manager', 'Manages the catalog: products, categories and stock.', [
            'dashboard.view', 'products.view', 'products.create', 'products.edit', 'products.delete',
            'categories.view', 'categories.manage', 'reviews.manage',
        ]],
        'order-manager' => ['Order Manager', 'Processes orders and manages coupons.', [
            'dashboard.view', 'reports.view', 'orders.view', 'orders.update_status',
            'customers.view', 'coupons.view', 'coupons.manage', 'products.view',
        ]],
        'support' => ['Support', 'Read-only access to help customers.', [
            'dashboard.view', 'orders.view', 'customers.view', 'products.view', 'coupons.view',
        ]],
    ];

    public function run(): void
    {
        foreach (PermissionRegistry::ALL as $group => $permissions) {
            foreach ($permissions as $name => $description) {
                Permission::updateOrCreate(['name' => $name], ['group' => $group, 'description' => $description]);
            }
        }

        $all = Permission::pluck('id', 'name');

        foreach (self::ROLES as $slug => [$name, $description, $grants]) {
            $role = Role::updateOrCreate(['slug' => $slug], ['name' => $name, 'description' => $description]);
            $role->forceFill(['is_system' => true])->save();
            $role->permissions()->sync($this->permissionIds($grants, $all->all()));
        }

        $superAdmin = Staff::firstOrCreate(
            ['email' => strtolower((string) env('SUPER_ADMIN_EMAIL', 'superadmin@nocfinity-shop.test'))],
            ['name' => 'Super Admin', 'password' => env('SUPER_ADMIN_PASSWORD', 'SuperAdmin@123'), 'email_verified_at' => now()],
        );
        $superAdmin->roles()->syncWithoutDetaching(Role::where('slug', Staff::SUPER_ADMIN)->pluck('id'));
    }

    /**
     * @param  list<string>  $grants  permission names, "*" for all, "!name" to exclude
     * @param  array<string, int>  $all
     * @return list<int>
     */
    private function permissionIds(array $grants, array $all): array
    {
        $names = in_array('*', $grants, true) ? array_keys($all) : array_filter($grants, fn ($g) => ! str_starts_with($g, '!'));
        $excluded = array_map(fn ($g) => substr($g, 1), array_filter($grants, fn ($g) => str_starts_with($g, '!')));

        return array_values(array_map(fn ($n) => $all[$n], array_diff($names, $excluded)));
    }
}
