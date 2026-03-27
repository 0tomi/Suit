<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class UdpDiscoveryServer extends Command
{
    protected $signature = 'suitapi:discovery
                            {--port= : Puerto UDP de escucha (sobreescribe DISCOVERY_PORT del .env)}';

    protected $description = 'Levanta el servidor UDP de descubrimiento para que SuitApp pueda encontrar SuitAPI en la red local.';

    public function handle(): int
    {
        $port = (int) ($this->option('port') ?: config('discovery.port', 41234));

        if (! extension_loaded('sockets')) {
            $this->error('La extensión PHP "sockets" no está habilitada. Por favor, actívala en php.ini.');

            return self::FAILURE;
        }

        $socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);

        if (! $socket) {
            $this->error('No se pudo crear el socket UDP: '.socket_strerror(socket_last_error()));

            return self::FAILURE;
        }

        // Permtimos recibir mensajes de broadcast
        socket_set_option($socket, SOL_SOCKET, SO_BROADCAST, 1);

        if (! socket_bind($socket, '0.0.0.0', $port)) {
            $this->error('No se pudo enlazar el socket al puerto '.$port.': '.socket_strerror(socket_last_error($socket)));
            socket_close($socket);

            return self::FAILURE;
        }

        $httpPort = config('discovery.http_port', 8000);
        $appName = config('app.name', 'SuitAPI');

        $this->info("Servidor UDP de descubrimiento escuchando en 0.0.0.0:{$port}");
        $this->comment("Responderá a solicitudes 'SUITAPI_DISCOVERY' indicando el puerto HTTP {$httpPort}.");
        $this->newLine();

        while (true) {
            $buffer = '';
            $clientIp = '';
            $clientPort = 0;

            // Bloquea la ejecución hasta recibir un datagrama UDP
            $bytes = socket_recvfrom($socket, $buffer, 1024, 0, $clientIp, $clientPort);

            if ($bytes === false) {
                $this->warn('Error al leer del socket: '.socket_strerror(socket_last_error($socket)));

                continue;
            }

            $message = trim($buffer);

            if ($message !== 'SUITAPI_DISCOVERY') {
                continue;
            }

            $this->line('  <fg=gray>'.now()->format('Y-m-d H:i:s')."</> Solicitud de {$clientIp}:{$clientPort}");

            $response = json_encode([
                'app' => $appName,
                'status' => 'OK',
                'http_port' => $httpPort,
            ]);

            // Respondemos directamente al cliente que preguntó
            socket_sendto($socket, $response, strlen($response), 0, $clientIp, $clientPort);
        }

        socket_close($socket);

        return self::SUCCESS;
    }
}
