<?php

namespace Tests;

use App\Models\Customer;
use App\Models\Staff;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function seedRoles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    protected function actingAsCustomer(?Customer $customer = null): Customer
    {
        $customer ??= Customer::factory()->create();
        $this->app['auth']->forgetGuards();
        $this->withToken($customer->createToken('test', ['customer'])->plainTextToken);

        return $customer;
    }

    protected function actingAsStaff(string $role): Staff
    {
        $staff = Staff::factory()->withRole($role)->create();
        $this->app['auth']->forgetGuards();
        $this->withToken($staff->createToken('test', ['admin'])->plainTextToken);

        return $staff;
    }
}
