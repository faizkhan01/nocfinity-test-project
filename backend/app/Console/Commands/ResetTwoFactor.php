<?php

namespace App\Console\Commands;

use App\Models\Staff;
use App\Services\Auth\TwoFactorService;
use Illuminate\Console\Command;

/** Break-glass recovery for staff who lost both their authenticator and recovery codes (incl. Super Admins). */
class ResetTwoFactor extends Command
{
    protected $signature = 'app:reset-two-factor {email? : Staff email to reset} {--list : List staff with 2FA enabled}';

    protected $description = 'Turn off two-factor authentication for a staff account and sign it out everywhere.';

    public function handle(TwoFactorService $twoFactor): int
    {
        if ($this->option('list') || ! $this->argument('email')) {
            $this->table(['ID', 'Email', '2FA since'], Staff::whereNotNull('two_factor_confirmed_at')
                ->get(['id', 'email', 'two_factor_confirmed_at'])->map->only('id', 'email', 'two_factor_confirmed_at'));

            if (! $this->argument('email')) {
                return self::SUCCESS;
            }
        }

        $staff = Staff::where('email', strtolower((string) $this->argument('email')))->first();

        if (! $staff) {
            $this->error('No staff account with that email.');

            return self::FAILURE;
        }

        $twoFactor->disable($staff);
        $staff->tokens()->delete();
        $this->info("Two-factor authentication reset for {$staff->email}; all of its sessions were signed out.");

        return self::SUCCESS;
    }
}
