<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SuitAPI File Management Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains the configuration for the SuitAPI file management
    | system, including the cleanup policy for soft-deleted records.
    |
    */

    /**
     * The number of days a soft-deleted file should be kept before it is
     * permanently removed from storage and the database by the cleanup command.
     */
    'cleanup_days' => env('FILES_CLEANUP_DAYS', 30),

];
