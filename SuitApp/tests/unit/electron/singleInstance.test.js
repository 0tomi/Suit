import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { configureSingleInstance } = require('../../../electron/singleInstance.cjs');

describe('singleInstance.cjs', () => {
    it('cierra el proceso cuando no obtiene el lock de instancia única', () => {
        const app = {
            requestSingleInstanceLock: vi.fn(() => false),
            quit: vi.fn(),
            on: vi.fn(),
        };

        const result = configureSingleInstance({
            app,
            onSecondInstance: vi.fn(),
            logger: { info: vi.fn() },
        });

        expect(result).toBe(false);
        expect(app.quit).toHaveBeenCalledTimes(1);
        expect(app.on).not.toHaveBeenCalled();
    });

    it('reenfoca la instancia activa cuando Windows intenta abrir otra copia', () => {
        const listeners = new Map();
        const onSecondInstance = vi.fn();
        const app = {
            requestSingleInstanceLock: vi.fn(() => true),
            quit: vi.fn(),
            on: vi.fn((eventName, handler) => {
                listeners.set(eventName, handler);
            }),
        };

        const result = configureSingleInstance({
            app,
            onSecondInstance,
            logger: { info: vi.fn() },
        });

        expect(result).toBe(true);
        expect(typeof listeners.get('second-instance')).toBe('function');

        listeners.get('second-instance')();

        expect(onSecondInstance).toHaveBeenCalledTimes(1);
        expect(app.quit).not.toHaveBeenCalled();
    });
});
