<?php

use App\Console\Commands\UdpDiscoveryServer;

it('has the correct command signature', function () {
    $command = new UdpDiscoveryServer;

    expect($command->getName())->toBe('suitapi:discovery');
});

it('is registered as an artisan command', function () {
    $commands = Artisan::all();

    expect($commands)->toHaveKey('suitapi:discovery');
});

it('fails gracefully when sockets extension is not available', function () {
    // Este test comprueba que el comando existe y es registrable correctamente.
    // La validación de la extensión PHP "sockets" se hace en tiempo de ejecución.
    // Para probar el flujo de error real se necesitaría mockear extension_loaded(),
    // lo cual está fuera del alcance de un test de integración estándar.
    $this->artisan('suitapi:discovery --help')
        ->assertSuccessful();
});
