<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Archive Session TTL
    |--------------------------------------------------------------------------
    |
    | How many minutes extracted historical version files remain on disk before
    | the cleanup command removes them. Increasing this reduces repeated
    | decompression work when a user browses multiple historical versions
    | in quick succession.
    |
    */
    'session_ttl_minutes' => env('DOCUMENT_SESSION_TTL_MINUTES', 15),

];
