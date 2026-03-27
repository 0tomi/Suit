<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Puerto del servidor UDP de descubrimiento
    |--------------------------------------------------------------------------
    |
    | Puerto donde SuitAPI escucha mensajes UDP de descubrimiento provenientes
    | de los clientes SuitApp en la red local.
    |
    */
    'port' => (int) env('DISCOVERY_PORT', 41234),

    /*
    |--------------------------------------------------------------------------
    | Puerto HTTP de la API
    |--------------------------------------------------------------------------
    |
    | Puerto en el que está corriendo el servidor HTTP (php artisan serve,
    | FrankenPHP, etc.). Este valor es el que se le informa al cliente
    | cuando responde a una solicitud de descubrimiento.
    |
    */
    'http_port' => (int) env('APP_PORT', 8443),

];
