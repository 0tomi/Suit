import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { bootstrapApp } = require('../../../electron/bootstrapApp.cjs');

describe('bootstrapApp.cjs', () => {
    it('corta el arranque, reporta el error y sale cuando falla una etapa fatal', async () => {
        const initializeLogService = vi.fn(() => {
            throw new Error('Invalid Windows filename');
        });
        const writeFatalStartupReport = vi.fn(() => ({
            ok: true,
            reportPath: '/tmp/suitapp/errores/startup-fatal.log',
        }));
        const logger = { error: vi.fn() };
        const showFatalError = vi.fn();
        const exitApp = vi.fn();

        const result = await bootstrapApp({
            app: {
                setAppUserModelId: vi.fn(),
            },
            initializeLogService,
            initDatabase: vi.fn(),
            applyCSP: vi.fn(),
            registerIpcHandlers: vi.fn(),
            createWindow: vi.fn(),
            createRuntimeManagers: vi.fn(),
            startNotifications: vi.fn(),
            logStartup: vi.fn(),
            logger,
            writeFatalStartupReport,
            showFatalError,
            exitApp,
        });

        expect(result.ok).toBe(false);
        expect(result.stage).toBe('log-service:init');
        expect(writeFatalStartupReport).toHaveBeenCalledWith(expect.objectContaining({
            stage: 'log-service:init',
        }));
        expect(logger.error).toHaveBeenCalledWith('fatal startup error', expect.objectContaining({
            stage: 'log-service:init',
            reportPath: '/tmp/suitapp/errores/startup-fatal.log',
        }));
        expect(showFatalError).toHaveBeenCalledWith(expect.objectContaining({
            stage: 'log-service:init',
            reportPath: '/tmp/suitapp/errores/startup-fatal.log',
        }));
        expect(exitApp).toHaveBeenCalledWith(1);
    });
});
