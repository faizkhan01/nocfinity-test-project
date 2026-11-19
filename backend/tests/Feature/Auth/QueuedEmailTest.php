<?php

namespace Tests\Feature\Auth;

use App\Models\Customer;
use App\Models\Staff;
use App\Notifications\QueuedResetPassword;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class QueuedEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_signing_up_queues_the_verification_email_on_the_high_priority_queue(): void
    {
        Queue::fake();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane', 'email' => 'jane@gmail.com', 'password' => 'Secret@1234', 'password_confirmation' => 'Secret@1234',
        ])->assertCreated();

        Queue::assertPushedOn('high', SendQueuedNotifications::class, fn (SendQueuedNotifications $job) => $job->notification instanceof QueuedVerifyEmail);
        Queue::assertNotPushed(SendQueuedNotifications::class, fn (SendQueuedNotifications $job) => $job->queue !== 'high');
    }

    public function test_password_reset_emails_are_queued_for_customers_and_staff(): void
    {
        $this->seedRoles();
        Queue::fake();
        Customer::factory()->create(['email' => 'jane@gmail.com']);
        Staff::factory()->withRole('support')->create(['email' => 'sam@gmail.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'jane@gmail.com'])->assertOk();
        $this->postJson('/api/v1/admin/auth/forgot-password', ['email' => 'sam@gmail.com'])->assertOk();

        Queue::assertPushedOn('high', SendQueuedNotifications::class, fn (SendQueuedNotifications $job) => $job->notification instanceof QueuedResetPassword);
        Queue::assertPushed(SendQueuedNotifications::class, 2);
    }

    public function test_the_queued_emails_still_carry_the_right_links(): void
    {
        Notification::fake();
        $customer = Customer::factory()->create(['email' => 'jane@gmail.com', 'email_verified_at' => null]);

        $customer->sendEmailVerificationNotification();
        $customer->sendPasswordResetNotification('reset-token');

        Notification::assertSentTo($customer, QueuedVerifyEmail::class, function (QueuedVerifyEmail $n) use ($customer) {
            $url = $n->toMail($customer)->actionUrl;

            return str_contains($url, '/api/v1/auth/email/verify/'.$customer->id.'/') && str_contains($url, 'signature=');
        });
        Notification::assertSentTo($customer, QueuedResetPassword::class, fn (QueuedResetPassword $n) => $n->toMail($customer)->actionUrl
            === config('app.frontend_url').'/reset-password?token=reset-token&email=jane%40gmail.com');
    }

    public function test_emails_go_out_only_if_the_surrounding_transaction_commits(): void
    {
        config(['mail.default' => 'array']);
        $customer = Customer::factory()->create(['email' => 'jane@gmail.com', 'email_verified_at' => null]);
        $send = function () use ($customer) {
            $customer->sendEmailVerificationNotification();
            $customer->sendPasswordResetNotification('token');
        };

        rescue(fn () => DB::transaction(function () use ($send) {
            $send();
            throw new \RuntimeException('rolled back');
        }), report: false);
        $this->assertCount(0, Mail::mailer('array')->getSymfonyTransport()->messages());

        DB::transaction($send);
        $this->assertCount(2, Mail::mailer('array')->getSymfonyTransport()->messages());
    }
}
