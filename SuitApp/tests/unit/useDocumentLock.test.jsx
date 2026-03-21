import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocumentLockStatusMock = vi.fn();
const lockDocumentMock = vi.fn();
const unlockDocumentMock = vi.fn();

vi.mock('../../src/services/documentService.js', () => ({
    getDocumentLockStatus: (...args) => getDocumentLockStatusMock(...args),
    lockDocument: (...args) => lockDocumentMock(...args),
    unlockDocument: (...args) => unlockDocumentMock(...args),
}));

import { useDocumentLock } from '../../src/hooks/useDocumentLock.js';

describe('useDocumentLock', () => {
    beforeEach(() => {
        getDocumentLockStatusMock.mockReset();
        lockDocumentMock.mockReset();
        unlockDocumentMock.mockReset();
    });

    it('habilita edicion cuando obtiene el lock', async () => {
        const setSaveMessage = vi.fn();

        getDocumentLockStatusMock.mockResolvedValue({
            ok: true,
            is_locked: false,
        });
        lockDocumentMock.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useDocumentLock({
            id: '9',
            setSaveMessage,
        }));

        expect(result.current.isEditing).toBe(false);

        await act(async () => {
            await result.current.enableEdit();
        });

        expect(getDocumentLockStatusMock).toHaveBeenCalledWith('9');
        expect(lockDocumentMock).toHaveBeenCalledWith('9');
        expect(result.current.isEditing).toBe(true);
        expect(result.current.isLockedByOther).toBe(false);
        expect(result.current.lockerName).toBe('');
        expect(setSaveMessage).toHaveBeenCalledWith(null);
    });

    it('deja el documento en solo lectura si otro usuario ya tiene lock', async () => {
        const setSaveMessage = vi.fn();

        getDocumentLockStatusMock.mockResolvedValue({
            ok: true,
            is_locked: true,
        });

        const { result } = renderHook(() => useDocumentLock({
            id: '15',
            setSaveMessage,
        }));

        await act(async () => {
            await result.current.enableEdit();
        });

        expect(lockDocumentMock).not.toHaveBeenCalled();
        expect(result.current.isEditing).toBe(false);
        expect(result.current.isLockedByOther).toBe(true);
        expect(result.current.lockerName).toBe('otro usuario');
        expect(setSaveMessage).toHaveBeenLastCalledWith({
            type: 'error',
            text: 'El documento está bloqueado por otro usuario.',
        });
    });

    it('libera el lock una sola vez aunque se invoque releaseLock y luego se desmonte', async () => {
        const setSaveMessage = vi.fn();

        getDocumentLockStatusMock.mockResolvedValue({
            ok: true,
            is_locked: false,
        });
        lockDocumentMock.mockResolvedValue({ ok: true });
        unlockDocumentMock.mockResolvedValue({ ok: true });

        const { result, unmount } = renderHook(() => useDocumentLock({
            id: '21',
            setSaveMessage,
        }));

        await act(async () => {
            await result.current.enableEdit();
        });

        await act(async () => {
            await result.current.releaseLock();
        });

        expect(unlockDocumentMock).toHaveBeenCalledTimes(1);
        expect(unlockDocumentMock).toHaveBeenCalledWith('21');

        unmount();

        await waitFor(() => {
            expect(unlockDocumentMock).toHaveBeenCalledTimes(1);
        });
    });
});
