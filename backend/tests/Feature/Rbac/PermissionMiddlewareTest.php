<?php

namespace Tests\Feature\Rbac;

use App\Models\Order;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PermissionMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_support_can_read_orders_but_not_change_them(): void
    {
        $this->actingAsStaff('support');

        $this->getJson('/api/v1/admin/orders')->assertOk();
        $this->patchJson('/api/v1/admin/orders/1/status', ['status' => 'shipped'])->assertForbidden();
        $this->postJson('/api/v1/admin/products', [])->assertForbidden();
        $this->getJson('/api/v1/admin/roles')->assertForbidden();
    }

    public function test_product_manager_cannot_see_orders_or_customers(): void
    {
        $this->actingAsStaff('product-manager');

        $this->getJson('/api/v1/admin/products')->assertOk();
        $this->getJson('/api/v1/admin/orders')->assertForbidden();
        $this->getJson('/api/v1/admin/customers')->assertForbidden();
    }

    public function test_access_follows_permissions_not_role_names(): void
    {
        $role = Role::create(['name' => 'Dispatcher', 'slug' => 'dispatcher']);
        $role->permissions()->sync(Permission::whereIn('name', ['orders.view', 'orders.update_status'])->pluck('id'));
        $this->actingAsStaff('dispatcher');

        $this->getJson('/api/v1/admin/orders')->assertOk();
        $this->getJson('/api/v1/admin/products')->assertForbidden();
    }

    public function test_admin_cannot_manage_roles_but_super_admin_can(): void
    {
        $this->actingAsStaff('admin');
        $this->postJson('/api/v1/admin/roles', ['name' => 'X Role', 'permissions' => []])->assertForbidden();

        $this->actingAsStaff(Staff::SUPER_ADMIN);
        $this->postJson('/api/v1/admin/roles', ['name' => 'X Role', 'permissions' => ['orders.view']])->assertCreated();
    }

    public function test_super_admin_role_and_accounts_are_protected(): void
    {
        $superAdmin = Staff::factory()->withRole(Staff::SUPER_ADMIN)->create();
        $superRole = Role::where('slug', Staff::SUPER_ADMIN)->first();

        $this->actingAsStaff(Staff::SUPER_ADMIN);
        $this->putJson("/api/v1/admin/roles/{$superRole->id}", ['name' => 'Renamed', 'permissions' => []])->assertForbidden();
        $this->deleteJson("/api/v1/admin/staff/{$superAdmin->id}")->assertForbidden();

        $this->actingAsStaff('admin');
        $this->postJson('/api/v1/admin/staff', [
            'name' => 'Sneaky', 'email' => 'sneaky@shop.test', 'password' => 'Sneaky@12345', 'roles' => [$superRole->id],
        ])->assertForbidden()->assertJsonPath('code', 'forbidden_role');
    }

    public function test_staff_cannot_mark_an_order_paid_by_hand(): void
    {
        $order = Order::factory()->create();
        $this->actingAsStaff('order-manager');

        $this->patchJson("/api/v1/admin/orders/{$order->id}/status", ['status' => 'paid'])
            ->assertUnprocessable()->assertJsonPath('code', 'invalid_transition');
    }
}
