<?php

namespace App\Providers;

use App\Mail\Transport\RecipientRoutingTransport;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\Payments\FakePaymentGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\StripeGateway;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use InvalidArgumentException;
use Stripe\StripeClient;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;
use Symfony\Contracts\HttpClient\HttpClientInterface;

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
        $this->configureMailTransports();
        $this->reportFailedJobs();
    }

    /** A job that used up its retries (e.g. an email the provider kept refusing) is logged and shown in the admin activity log. */
    private function reportFailedJobs(): void
    {
        Queue::failing(function (JobFailed $event) {
            $details = [
                'job' => $event->job->resolveName(),
                'queue' => $event->job->getQueue(),
                'attempts' => $event->job->attempts(),
                'error' => Str::limit($event->exception->getMessage(), 300),
            ];

            Log::critical('Queued job failed after all retries', $details);
            rescue(fn () => $this->app->make(ActivityLogger::class)->log('queue.job_failed', null, $details), report: false);
        });
    }

    private function configureMailTransports(): void
    {
        Mail::extend('brevo', function (array $config) {
            if (empty($config['key'])) {
                throw new InvalidArgumentException('MAIL_MAILER uses Brevo but BREVO_API_KEY is not set.');
            }

            $client = $this->app->bound(HttpClientInterface::class) ? $this->app->make(HttpClientInterface::class) : HttpClient::create(['timeout' => 15]);

            return (new BrevoTransportFactory(null, $client))->create(new Dsn('brevo+api', 'default', $config['key']));
        });

        Mail::extend('routed', fn (array $config) => new RecipientRoutingTransport(
            Mail::mailer($config['deliverable'])->getSymfonyTransport(),
            Mail::mailer($config['placeholder'])->getSymfonyTransport(),
            config('mail.placeholder_domains'),
        ));
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(config('shop.rate_limits.api'))->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(config('shop.rate_limits.auth'))->by($request->ip()));

        RateLimiter::for('checkout', fn (Request $request) => Limit::perMinute(config('shop.rate_limits.checkout'))->by($request->user()?->id ?: $request->ip()));
    }
}
