import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suitapp-media-cache-'));

let performHttpRequest;
let clearProfileMediaCache;

describe('electron/mediaCache + httpProxy', () => {
    beforeEach(async () => {
        vi.resetModules();
        globalThis.__SUITAPP_TEST_ELECTRON_APP__ = {
            getPath: vi.fn(() => userDataRoot),
        };
        vi.doMock('../../../electron/logService.cjs', () => ({
            getLogger: () => ({
                warn: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
            }),
        }));

        const httpProxyModule = await import('../../../electron/httpProxy.cjs');
        const mediaCacheModule = await import('../../../electron/mediaCache.cjs');

        performHttpRequest = httpProxyModule.performHttpRequest
            ?? httpProxyModule.default?.performHttpRequest;
        clearProfileMediaCache = mediaCacheModule.clearProfileMediaCache
            ?? mediaCacheModule.default?.clearProfileMediaCache;

        clearProfileMediaCache(7);
        global.fetch = vi.fn();
    });

    afterAll(() => {
        clearProfileMediaCache?.(7);
        fs.rmSync(userDataRoot, { recursive: true, force: true });
        delete globalThis.__SUITAPP_TEST_ELECTRON_APP__;
    });

    it('persiste blobs multimedia y reutiliza la caché local en el segundo acceso', async () => {
        const networkBytes = Uint8Array.from([11, 22, 33, 44]);
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: vi.fn().mockResolvedValue(networkBytes.buffer),
        });

        const request = {
            url: 'http://127.0.0.1:8000/api/documents/99',
            method: 'GET',
            responseType: 'arraybuffer',
            cache: {
                enabled: true,
                profileId: 7,
                group: 'document-99',
                key: 'document-99:2026-03-15T12:00:00.000000Z',
            },
        };

        const firstResponse = await performHttpRequest(request);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(firstResponse.ok).toBe(true);
        expect(firstResponse.headers['x-suitapp-cache']).toBe('miss');
        expect(firstResponse.data).toEqual([11, 22, 33, 44]);

        global.fetch.mockClear();

        const secondResponse = await performHttpRequest(request);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(secondResponse.ok).toBe(true);
        expect(secondResponse.headers['x-suitapp-cache']).toBe('hit');
        expect(secondResponse.data).toEqual([11, 22, 33, 44]);

        const cacheDir = path.join(userDataRoot, 'media-cache', 'profile_7');
        expect(fs.existsSync(cacheDir)).toBe(true);
        expect(fs.readdirSync(cacheDir).some((entry) => entry.endsWith('.bin'))).toBe(true);
    });
});
