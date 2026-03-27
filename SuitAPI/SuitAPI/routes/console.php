<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Clean up temporarily extracted document version files when their TTL expires.
Schedule::command('documents:cleanup-archives')->everyMinute()->withoutOverlapping();
