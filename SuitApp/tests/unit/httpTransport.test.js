import { beforeEach, describe, expect, it, vi } from 'vitest';

const isElectron = vi.fn();

vi.mock('../../src/utils/platform.js', () => ({
    isElectron: (...args) => isElectron(...args),
}));

import { performHttpRequest } from '../../src/services/httpTransport.js';

describe('httpTransport', () => {
    beforeEach(() => {
        isElectron.mockReset();
        delete window.electronAPI;
        global.fetch = vi.fn();
    });

    it('usa el proxy IPC en Electron y serializa FormData', async () => {
        isElectron.mockReturnValue(true);
        window.electronAPI = {
            http: {
                request: vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    data: { ok: true },
                }),
            },
        };

        const formData = new FormData();
        formData.append('name', 'Suit');
        formData.append(
            'photo',
            new File([Uint8Array.from([1, 2, 3])], 'avatar.png', { type: 'image/png' }),
        );

        await performHttpRequest({
            url: 'http://127.0.0.1:8000/api/user/profile-photo',
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData,
        });

        expect(global.fetch).not.toHaveBeenCalled();
        expect(window.electronAPI.http.request).toHaveBeenCalledTimes(1);

        const payload = window.electronAPI.http.request.mock.calls[0][0];
        expect(payload.body.kind).toBe('form-data');
        expect(payload.body.parts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'field', name: 'name', value: 'Suit' }),
            expect.objectContaining({
                kind: 'file',
                name: 'photo',
                filename: 'avatar.png',
                mimeType: 'image/png',
                bytes: [1, 2, 3],
            }),
        ]));
    });

    it('usa fetch directo fuera de Electron', async () => {
        isElectron.mockReturnValue(false);
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: vi.fn().mockResolvedValue({ success: true }),
        });

        const response = await performHttpRequest({
            url: 'http://127.0.0.1:8000/api/login',
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            query: { page: 2 },
            body: { tag: 'admin' },
        });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://127.0.0.1:8000/api/login?page=2',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ tag: 'admin' }),
            }),
        );
        expect(response).toEqual(expect.objectContaining({
            ok: true,
            status: 200,
            data: { success: true },
        }));
    });
});
