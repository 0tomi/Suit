import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    discoverServerWithSocketFactory,
} = require('../../electron/discovery.cjs');

class FakeSocket extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.closed = false;
        this.broadcastEnabled = false;
        this.sent = null;
    }

    bind(_port, callback) {
        if (this.options.bindError) {
            setTimeout(() => this.emit('error', this.options.bindError), 0);
            return;
        }
        callback?.();
    }

    setBroadcast(value) {
        this.broadcastEnabled = value;
        if (this.options.broadcastError) {
            throw this.options.broadcastError;
        }
    }

    send(buffer, port, host, callback) {
        this.sent = {
            payload: buffer.toString('utf8'),
            port,
            host,
        };
        callback?.(this.options.sendError || null);
        if (!this.options.sendError) {
            this.options.onSend?.(this);
        }
    }

    close() {
        this.closed = true;
    }
}

describe('discovery.cjs', () => {
    it('retorna host y puerto cuando recibe una respuesta válida', async () => {
        const socket = new FakeSocket({
            onSend(currentSocket) {
                setTimeout(() => {
                    currentSocket.emit(
                        'message',
                        Buffer.from(JSON.stringify({
                            app: 'SuitAPI',
                            status: 'OK',
                            http_port: 8000,
                        })),
                        { address: '192.168.1.50' }
                    );
                }, 0);
            },
        });

        const result = await discoverServerWithSocketFactory({
            createSocket: () => socket,
            timeoutMs: 50,
        });

        expect(result).toEqual({
            ok: true,
            host: '192.168.1.50',
            port: 8000,
        });
        expect(socket.broadcastEnabled).toBe(true);
        expect(socket.sent).toEqual({
            payload: 'SUITAPI_DISCOVERY',
            port: 41234,
            host: '255.255.255.255',
        });
        expect(socket.closed).toBe(true);
    });

    it('devuelve invalid-response cuando sólo llegan payloads inválidos', async () => {
        const socket = new FakeSocket({
            onSend(currentSocket) {
                setTimeout(() => {
                    currentSocket.emit('message', Buffer.from('not-json'), { address: '192.168.1.20' });
                }, 0);
            },
        });

        const result = await discoverServerWithSocketFactory({
            createSocket: () => socket,
            timeoutMs: 20,
        });

        expect(result).toMatchObject({
            ok: false,
            reason: 'invalid-response',
        });
        expect(socket.closed).toBe(true);
    });

    it('devuelve timeout cuando no llega ninguna respuesta', async () => {
        const socket = new FakeSocket();

        const result = await discoverServerWithSocketFactory({
            createSocket: () => socket,
            timeoutMs: 20,
        });

        expect(result).toMatchObject({
            ok: false,
            reason: 'timeout',
        });
        expect(socket.closed).toBe(true);
    });

    it('devuelve socket-error cuando falla el socket', async () => {
        const socket = new FakeSocket({
            onSend(currentSocket) {
                setTimeout(() => currentSocket.emit('error', new Error('boom')), 0);
            },
        });

        const result = await discoverServerWithSocketFactory({
            createSocket: () => socket,
            timeoutMs: 20,
        });

        expect(result).toMatchObject({
            ok: false,
            reason: 'socket-error',
            message: 'boom',
        });
        expect(socket.closed).toBe(true);
    });
});
