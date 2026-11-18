<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use App\Services\Payments\FakePaymentGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\StripeGateway;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Stripe\StripeClient;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, fn () => $this->app->environment('testing')
            ? new FakePaymentGateway
            : new StripeGateway(new StripeClient((string) config('services.stripe.secret'))));
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

        Password::defaults(function () {
            $rule = Password::min(8)->max(72)->letters()->mixedCase()->numbers()->symbols();

            return $this->app->isProduction() ? $rule->uncompromised() : $rule;
        });

        ResetPassword::createUrlUsing(function (User $user, string $token) {
            $path = $user instanceof Staff ? '/admin/reset-password' : '/reset-password';

            return config('app.frontend_url').$path.'?'.http_build_query(['token' => $token, 'email' => $user->email]);
        });

        VerifyEmail::createUrlUsing(fn (User $user) => URL::temporarySignedRoute(
            'auth.verification.verify',
            now()->addMinutes(60),
            ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())],
        ));

        // Super Admin implicitly holds every permission.
        Gate::before(fn ($user) => $user instanceof Staff && $user->isSuperAdmin() ? true : null);

        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        RateLimiter::for('checkout', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));
    }
}
