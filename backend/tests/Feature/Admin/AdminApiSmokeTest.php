<?php

namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\Staff;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Every admin read endpoint must render real seeded data under strict mode (no lazy loads, no missing columns). */
class AdminApiSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_admin_read_endpoints_render_seeded_data(): void
    {
        Storage::fake('public');
        $this->seed(DatabaseSeeder::class);
        $this->actingAsStaff(Staff::SUPER_ADMIN);

        $endpoints = [
            'dashboard', 'orders', 'orders?status=delivered&search=ORD', 'orders/1', 'products', 'products?stock=low', 'products/1',
            'categories', 'coupons', 'customers', 'customers/'.Customer::query()->value('id'), 'reviews', 'roles', 'permissions', 'staff', 'activity-logs',
        ];

        foreach ($endpoints as $endpoint) {
            $this->getJson("/api/v1/admin/{$endpoint}")->assertOk();
        }

        $this->getJson('/api/v1/admin/dashboard')->assertJsonCount(30, 'data.sales_chart');
    }
}
