const dgram = require('node:dgram');

const DISCOVERY_PORT = 41234;
const DISCOVERY_MESSAGE = 'SUITAPI_DISCOVERY';
const DISCOVERY_BROADCAST_HOST = '255.255.255.255';
const DISCOVERY_TIMEOUT_MS = 3000;

function buildFailure(reason, message, extra = {}) {
    return {
        ok: false,
        reason,
        message,
        ...extra,
    };
}

function parseDiscoveryResponse(payload, rinfo) {
    let parsed;

    try {
        parsed = JSON.parse(String(payload));
    } catch {
        return null;
    }

    if (parsed?.app !== 'SuitAPI' || parsed?.status !== 'OK') {
        return null;
    }

    const port = Number(parsed?.http_port);
    if (!Number.isInteger(port) || port <= 0) {
        return null;
    }

    if (!rinfo?.address) {
        return null;
    }

    return {
        ok: true,
        host: rinfo.address,
        port,
    };
}

function discoverServerWithSocketFactory({
    createSocket = () => dgram.createSocket('udp4'),
    timeoutMs = DISCOVERY_TIMEOUT_MS,
    port = DISCOVERY_PORT,
    message = DISCOVERY_MESSAGE,
    broadcastHost = DISCOVERY_BROADCAST_HOST,
} = {}) {
    return new Promise((resolve) => {
        const socket = createSocket('udp4');
        let timeoutId = null;
        let settled = false;
        let sawInvalidResponse = false;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            try {
                socket.close();
            } catch {
                // ignore socket close errors during teardown
            }
        };

        const finish = (result) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result);
        };

        socket.once('error', (error) => {
            finish(buildFailure('socket-error', error?.message || 'No se pudo iniciar el descubrimiento UDP.'));
        });

        socket.on('message', (payload, rinfo) => {
            const discovered = parseDiscoveryResponse(payload, rinfo);
            if (discovered) {
                finish(discovered);
                return;
            }
            sawInvalidResponse = true;
        });

        socket.bind(0, () => {
            try {
                socket.setBroadcast(true);
            } catch (error) {
                finish(buildFailure('socket-error', error?.message || 'No se pudo habilitar broadcast UDP.'));
                return;
            }

            socket.send(Buffer.from(message, 'utf8'), port, broadcastHost, (error) => {
                if (error) {
                    finish(buildFailure('socket-error', error?.message || 'No se pudo enviar el broadcast de descubrimiento.'));
                    return;
                }

                timeoutId = setTimeout(() => {
                    if (sawInvalidResponse) {
                        finish(buildFailure('invalid-response', 'Se recibio una respuesta UDP invalida de discovery.'));
                        return;
                    }
                    finish(buildFailure('timeout', 'No se encontro ningun servidor SuitAPI en la red local.'));
                }, timeoutMs);
            });
        });
    });
}

async function discoverServer() {
    return await discoverServerWithSocketFactory();
}

module.exports = {
    DISCOVERY_BROADCAST_HOST,
    DISCOVERY_MESSAGE,
    DISCOVERY_PORT,
    DISCOVERY_TIMEOUT_MS,
    buildFailure,
    discoverServer,
    discoverServerWithSocketFactory,
    parseDiscoveryResponse,
};
