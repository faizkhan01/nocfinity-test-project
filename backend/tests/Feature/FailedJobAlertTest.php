<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Tests\TestCase;

class FailedJobAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_job_that_runs_out_of_retries_is_logged_and_shown_to_admins(): void
    {
        Log::spy();

        // PendingDispatch sends on destruct, so dispatch inside a block to catch the sync queue's rethrow.
        rescue(function () {
            FailingEmailJob::dispatch();
        }, report: false);

        $entry = ActivityLog::where('action', 'queue.job_failed')->sole();
        $this->assertSame(FailingEmailJob::class, $entry->properties['job']);
        $this->assertSame('Brevo said no', $entry->properties['error']);
        $this->assertNull($entry->user_id, 'Recorded by the system, not a staff member');
        Log::shouldHaveReceived('critical')->once()->withArgs(fn (string $message, array $context) => $context['job'] === FailingEmailJob::class);
    }

    public function test_jobs_that_succeed_leave_no_alert(): void
    {
        FailingEmailJob::dispatch(fail: false);

        $this->assertSame(0, ActivityLog::where('action', 'queue.job_failed')->count());
    }
}

class FailingEmailJob implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function __construct(private bool $fail = true) {}

    public function handle(): void
    {
        if ($this->fail) {
            throw new RuntimeException('Brevo said no');
        }
    }
}
