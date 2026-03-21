import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CONTEXTO:
 * - El logger del renderer sigue mostrando mensajes localmente en DEV.
 * - El cambio reciente reduce el reenvío al proceso main: `info/debug` no deben
 *   persistirse por IPC por defecto, mientras `warn/error` sí.
 *
 * RIESGO CUBIERTO:
 * - Que vuelva el spam de IPC durante sync/startup.
 * - Que se pierdan advertencias y errores que sí deben seguir persistiendo.
 */

describe('renderer logService', () => {
    beforeEach(() => {
        vi.resetModules();
        window.electronAPI = {
            logs: {
                debug: vi.fn().mockResolvedValue(true),
                info: vi.fn().mockResolvedValue(true),
                warn: vi.fn().mockResolvedValue(true),
                error: vi.fn().mockResolvedValue(true),
            },
        };

        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('no reenvía info ni debug al proceso main por defecto', async () => {
        const { createLogger } = await import('../../src/services/logService.js');
        const logger = createLogger('tests');

        await logger.debug('debug renderer');
        await logger.info('info renderer');

        expect(window.electronAPI.logs.debug).not.toHaveBeenCalled();
        expect(window.electronAPI.logs.info).not.toHaveBeenCalled();
    });

    it('mantiene el reenvío de warn y error al proceso main', async () => {
        const { createLogger } = await import('../../src/services/logService.js');
        const logger = createLogger('tests');

        await logger.warn('warn renderer');
        await logger.error('error renderer');

        expect(window.electronAPI.logs.warn).toHaveBeenCalledWith(expect.objectContaining({
            scope: 'tests',
            message: 'warn renderer',
        }));
        expect(window.electronAPI.logs.error).toHaveBeenCalledWith(expect.objectContaining({
            scope: 'tests',
            message: 'error renderer',
        }));
    });
});
