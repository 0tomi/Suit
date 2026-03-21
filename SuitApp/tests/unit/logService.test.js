import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('../../electron/logService.cjs');

function loadLogServiceModule() {
    delete require.cache[modulePath];
    return require(modulePath);
}

function createTempUserDataDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'suit-log-service-'));
}

function createFakeApp(userDataDir, { isPackaged = true } = {}) {
    return {
        isPackaged,
        getPath(targetPath) {
            if (targetPath !== 'userData') {
                throw new Error(`Unexpected path request: ${targetPath}`);
            }
            return userDataDir;
        },
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('logService.cjs', () => {
    it('crea logs de sesión con nombres compatibles con Windows', () => {
        const userDataDir = createTempUserDataDir();
        const { initializeLogService } = loadLogServiceModule();

        const runtime = initializeLogService({
            app: createFakeApp(userDataDir),
        });

        const fileName = path.basename(runtime.sessionLogPath);

        expect(fs.existsSync(runtime.sessionLogPath)).toBe(true);
        expect(fileName).toMatch(/^log-\d{2}-\d{2}-\d{4}_\d{2}-\d{2}_\d{3}\.log$/);
        expect(fileName).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('incrementa el índice del log dentro del mismo minuto', () => {
        const userDataDir = createTempUserDataDir();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-12T15:42:00.000Z'));

        const { initializeLogService } = loadLogServiceModule();
        const app = createFakeApp(userDataDir);

        const firstRuntime = initializeLogService({ app });
        const secondRuntime = initializeLogService({ app });

        expect(path.basename(firstRuntime.sessionLogPath)).toContain('_001.log');
        expect(path.basename(secondRuntime.sessionLogPath)).toContain('_002.log');
    });

    it('escribe un reporte fatal de arranque aunque falle el logger principal', () => {
        const userDataDir = createTempUserDataDir();
        const { writeFatalStartupReport } = loadLogServiceModule();

        const report = writeFatalStartupReport({
            app: createFakeApp(userDataDir),
            stage: 'log-service:init',
            error: new Error('Invalid Windows filename'),
        });

        expect(report.ok).toBe(true);
        expect(report.reportPath).toContain(path.join('errores', 'startup-fatal-'));
        expect(fs.existsSync(report.reportPath)).toBe(true);

        const reportContents = fs.readFileSync(report.reportPath, 'utf8');
        expect(reportContents).toContain('Stage: log-service:init');
        expect(reportContents).toContain('Invalid Windows filename');
    });
});
