<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/** The framework's password reset email, sent by the queue worker ahead of other mail. */
class QueuedResetPassword extends ResetPassword implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** @var list<int> */
    public array $backoff = [10, 60, 300, 900];

    public function __construct(#[\SensitiveParameter] string $token)
    {
        parent::__construct($token);
        $this->onQueue('high');
        $this->afterCommit();
    }
}
