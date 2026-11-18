<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IsSeeded extends Command
{
    protected $signature = 'app:is-seeded';

    protected $description = 'Print "yes" when the database already holds seed data (used by the Docker entrypoint).';

    public function handle(): int
    {
        $this->line(DB::table('users')->exists() ? 'yes' : 'no');

        return self::SUCCESS;
    }
}
