<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/** The framework's verification email, sent by the queue worker ahead of other mail. */
class QueuedVerifyEmail extends VerifyEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** @var list<int> seconds between attempts, so a short mail-provider outage is ridden out */
    public array $backoff = [10, 60, 300, 900];

    public function __construct()
    {
        $this->onQueue('high');
        $this->afterCommit();
    }
}
