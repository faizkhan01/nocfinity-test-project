<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());

        Relation::enforceMorphMap([
            'customer' => Customer::class,
            'staff' => Staff::class,
            'product' => Product::class,
            'category' => Category::class,
            'order' => Order::class,
            'coupon' => Coupon::class,
            'role' => Role::class,
        ]);
    }
}
