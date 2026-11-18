<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            StaffSeeder::class,
            CatalogSeeder::class,
            CouponSeeder::class,
            OrderSeeder::class,
        ]);
    }
}
