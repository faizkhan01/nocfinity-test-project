<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Staff;
use Illuminate\Database\Seeder;

/** One demo account per built-in role; passwords are documented in the README. */
class StaffSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            ['Ada Admin', 'admin@nocfinity-shop.test', 'admin'],
            ['Paul Products', 'products@nocfinity-shop.test', 'product-manager'],
            ['Olivia Orders', 'orders@nocfinity-shop.test', 'order-manager'],
            ['Sam Support', 'support@nocfinity-shop.test', 'support'],
        ];

        foreach ($accounts as [$name, $email, $role]) {
            $staff = Staff::create(['name' => $name, 'email' => $email, 'password' => 'Staff@12345', 'email_verified_at' => now()]);
            $staff->roles()->attach(Role::where('slug', $role)->value('id'));
        }
    }
}
