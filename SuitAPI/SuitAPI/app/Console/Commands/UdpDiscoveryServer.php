<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class UdpDiscoveryServer extends Command
{
    protected $signature = 'suitapi:discovery
                            {--port= : Puerto UDP de escucha (sobreescribe DISCOVERY_PORT del .env)}';

    protected $description = 'Levanta el servidor UDP de descubrimiento para que SuitApp pueda encontrar SuitAPI en la red local.';

    protected bool $running = true;

    public function handle(): int
    {
        $port = (int) ($this->option('port') ?: config('discovery.port', 41234));

        if (! extension_loaded('sockets')) {
            $this->error('La extensión PHP "sockets" no está habilitada. Por favor, actívala en php.ini.');

            return self::FAILURE;
        }

        // Usamos el sistema de trap de Laravel 12 para manejar señales de forma robusta si pcntl está disponible
        $signals = [];
        if (defined('SIGINT')) {
            $signals[] = SIGINT;
        }
        if (defined('SIGTERM')) {
            $signals[] = SIGTERM;
        }
        if (defined('SIGQUIT')) {
            $signals[] = SIGQUIT;
        }

        if (! empty($signals)) {
            $this->trap($signals, function () {
                $this->comment('Recibida señal de detención...');
                $this->running = false;
            });
        }

        // Manejador nativo para Windows (sapi/cli)
        if (function_exists('sapi_windows_set_ctrl_handler')) {
            sapi_windows_set_ctrl_handler(function (int $event) {
                $this->comment('Recibida señal de detención (Windows)...');
                $this->running = false;
            });
        }

        $socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);

        if (! $socket) {
            $this->error('No se pudo crear el socket UDP: '.socket_strerror(socket_last_error()));

            return self::FAILURE;
        }

        try {
            // Permitimos reutilizar la dirección/puerto inmediatamente tras un cierre (útil ante crasheos)
            socket_set_option($socket, SOL_SOCKET, SO_REUSEADDR, 1);

            // Permitimos recibir mensajes de broadcast
            socket_set_option($socket, SOL_SOCKET, SO_BROADCAST, 1);

            if (! socket_bind($socket, '0.0.0.0', $port)) {
                $this->error("No se pudo enlazar el socket al puerto {$port}: ".socket_strerror(socket_last_error($socket)));

                return self::FAILURE;
            }

            $httpPort = config('discovery.http_port', 8000);
            $appName = config('app.name', 'SuitAPI');

            $this->info("Servidor UDP de descubrimiento escuchando en 0.0.0.0:{$port}");
            $this->comment("Responderá a solicitudes 'SUITAPI_DISCOVERY' indicando el puerto HTTP {$httpPort}.");
            $this->info('Presiona CTRL+C para detener el servidor.');
            $this->newLine();

            while ($this->running) {
                $buffer = '';
                $clientIp = '';
                $clientPort = 0;

                // Usamos socket_select para esperar al datagrama sin bloquear indefinidamente,
                // esto nos permite verificar el estado de $this->running periódicamente.
                $read = [$socket];
                $write = null;
                $except = null;
                $changed = @socket_select($read, $write, $except, 1); // Timeout de 1 seg

                if ($changed === false) {
                    $err = socket_last_error($socket);
                    // Si el error fue por interrupción de señal (EINTR), simplemente continuamos o terminamos
                    if ($err === SOCKET_EINTR) {
                        continue;
                    }

                    if ($this->running) {
                        $this->warn('Error en socket_select: '.socket_strerror($err));
                    }
                    break;
                }

                if ($changed === 0) {
                    // Time out, volvemos a checkear el loop
                    continue;
                }

                // Recibimos el datagrama UDP
                $bytes = socket_recvfrom($socket, $buffer, 1024, 0, $clientIp, $clientPort);

                if ($bytes === false) {
                    $err = socket_last_error($socket);
                    if ($err === SOCKET_EINTR) {
                        continue;
                    }
                    $this->warn('Error al leer del socket: '.socket_strerror($err));

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
                @socket_sendto($socket, $response, strlen($response), 0, $clientIp, $clientPort);
            }
        } catch (\Throwable $e) {
            $this->error('Error inesperado en el servidor UDP: '.$e->getMessage());

            return self::FAILURE;
        } finally {
            $this->comment('Cerrando servidor UDP...');
            @socket_close($socket);
            $this->info('Servidor UDP detenido correctamente.');
        }

        return self::SUCCESS;
    }
}
