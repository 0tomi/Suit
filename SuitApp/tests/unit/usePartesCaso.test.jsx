/**
 * Tests unitarios para usePartesCaso.js
 *
 * Cubre:
 * - PAR-4: Race condition en unlinkParte — verifica que se usa deleteWhere atómico
 *   en vez de clearTable + upsertMany no-atómico.
 * - PAR-5: Fallback offline — verifica que al fallar la API se sirven datos
 *   desde SQLite con flag isStale: true.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePartesCaso } from '../../src/hooks/usePartesCaso.js';

// Mock de parteService para controlar las respuestas de API
vi.mock('../../src/services/parteService.js', () => ({
    getPartesByCaso: vi.fn(),
    linkParteToCaso: vi.fn(),
    unlinkParteFromCaso: vi.fn(),
}));

// Mock de logService para silenciar logs en tests
vi.mock('../../src/services/logService.js', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

import { getPartesByCaso, linkParteToCaso, unlinkParteFromCaso } from '../../src/services/parteService.js';

const CASE_ID = 42;

const PARTE_A = { id: 1, nombre: 'Juan', apellido: 'García', rol_id: 2 };
const PARTE_B = { id: 2, nombre: 'Ana', apellido: 'López', rol_id: 3 };

/**
 * Crea un mock de window.electronAPI con las funciones DB necesarias.
 * Por defecto responde con un pivot vacío y partes vacías.
 */
function createDbMock({ pivotRows = [], parteRows = [] } = {}) {
    return {
        db: {
            getAll: vi.fn(async (table) => {
                if (table === 'parte_caso') return pivotRows;
                if (table === 'partes') return parteRows;
                return [];
            }),
            upsertMany: vi.fn().mockResolvedValue(undefined),
            deleteWhere: vi.fn().mockResolvedValue(undefined),
            clearTable: vi.fn().mockResolvedValue(undefined),
        },
        logs: {
            debug: vi.fn().mockResolvedValue(true),
            info: vi.fn().mockResolvedValue(true),
            warn: vi.fn().mockResolvedValue(true),
            error: vi.fn().mockResolvedValue(true),
        },
    };
}

describe('usePartesCaso — PAR-4: operaciones atómicas en el pivot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loadData usa deleteWhere(suit_case_id) en vez de clearTable global', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;
        getPartesByCaso.mockResolvedValue([PARTE_A, PARTE_B]);

        const { result } = renderHook(() => usePartesCaso(CASE_ID));

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Verifica que se usó deleteWhere solo para el caseId actual
        expect(dbMock.db.deleteWhere).toHaveBeenCalledWith('parte_caso', { suit_case_id: CASE_ID });
        // Verifica que NO se usó clearTable (que borraba todo el pivot)
        expect(dbMock.db.clearTable).not.toHaveBeenCalled();
        // Verifica que upsertMany inserció los nuevos pivots
        expect(dbMock.db.upsertMany).toHaveBeenCalledWith('parte_caso', [
            { parte_id: PARTE_A.id, suit_case_id: CASE_ID },
            { parte_id: PARTE_B.id, suit_case_id: CASE_ID },
        ]);
    });

    it('unlinkParte usa deleteWhere atómico con ambas claves del pivot', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;
        getPartesByCaso.mockResolvedValue([PARTE_A, PARTE_B]);
        unlinkParteFromCaso.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        // Limpiar calls del loadData inicial
        dbMock.db.deleteWhere.mockClear();
        dbMock.db.clearTable.mockClear();
        dbMock.db.getAll.mockClear();

        await act(async () => {
            await result.current.unlinkParte(PARTE_A.id);
        });

        // PAR-4: debe usar deleteWhere con el par exacto (parte_id, suit_case_id)
        expect(dbMock.db.deleteWhere).toHaveBeenCalledWith('parte_caso', {
            parte_id: PARTE_A.id,
            suit_case_id: CASE_ID,
        });
        // PAR-4: NO debe hacer getAll + clearTable (patrón no-atómico previo)
        expect(dbMock.db.clearTable).not.toHaveBeenCalled();
        expect(dbMock.db.getAll).not.toHaveBeenCalledWith('parte_caso');
    });

    it('unlinkParte aplica actualización optimista al estado local', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;
        getPartesByCaso.mockResolvedValue([PARTE_A, PARTE_B]);
        unlinkParteFromCaso.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.partesCaso).toHaveLength(2);

        await act(async () => {
            await result.current.unlinkParte(PARTE_A.id);
        });

        // La parte desvinculada debe desaparecer del estado local inmediatamente
        expect(result.current.partesCaso).toHaveLength(1);
        expect(result.current.partesCaso[0].id).toBe(PARTE_B.id);
    });

    it('loadData sigue escribiendo el pivot del caso de forma scoped tras leer la caché inicial', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;
        getPartesByCaso.mockResolvedValue([PARTE_A]);

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(dbMock.db.getAll).toHaveBeenCalledWith('parte_caso');
        expect(dbMock.db.deleteWhere).toHaveBeenCalledWith('parte_caso', { suit_case_id: CASE_ID });
        expect(dbMock.db.clearTable).not.toHaveBeenCalled();
    });
});

describe('usePartesCaso — PAR-5: fallback offline desde SQLite', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('al fallar la API, sirve partes desde la caché SQLite con isStale: true', async () => {
        const pivotRows = [
            { parte_id: PARTE_A.id, suit_case_id: CASE_ID },
            { parte_id: PARTE_B.id, suit_case_id: CASE_ID },
        ];
        const dbMock = createDbMock({ pivotRows, parteRows: [PARTE_A, PARTE_B] });
        window.electronAPI = dbMock;
        // API falla
        getPartesByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        // PAR-5: debe servir datos desde caché
        expect(result.current.partesCaso).toHaveLength(2);
        expect(result.current.isStale).toBe(true);
        expect(result.current.error).toBeNull();
    });

    it('al fallar la API, las partes cacheadas tienen flag isStale: true en cada item', async () => {
        const pivotRows = [{ parte_id: PARTE_A.id, suit_case_id: CASE_ID }];
        const dbMock = createDbMock({ pivotRows, parteRows: [PARTE_A] });
        window.electronAPI = dbMock;
        getPartesByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.partesCaso[0].isStale).toBe(true);
        expect(result.current.partesCaso[0].id).toBe(PARTE_A.id);
    });

    it('al fallar la API, solo devuelve partes del caso actual (no de otros casos)', async () => {
        // Pivot con partes de dos casos distintos
        const pivotRows = [
            { parte_id: PARTE_A.id, suit_case_id: CASE_ID },
            { parte_id: PARTE_B.id, suit_case_id: 999 }, // otro caso
        ];
        const dbMock = createDbMock({ pivotRows, parteRows: [PARTE_A, PARTE_B] });
        window.electronAPI = dbMock;
        getPartesByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        // Solo debe retornar la parte del CASE_ID, no la de otro caso
        expect(result.current.partesCaso).toHaveLength(1);
        expect(result.current.partesCaso[0].id).toBe(PARTE_A.id);
    });

    it('cuando la API responde OK, isStale es false', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;
        getPartesByCaso.mockResolvedValue([PARTE_A]);

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.isStale).toBe(false);
        expect(result.current.partesCaso).toHaveLength(1);
    });

    it('puede reutilizar solo la caché inicial sin llamar a la API', async () => {
        const pivotRows = [{ parte_id: PARTE_A.id, suit_case_id: CASE_ID }];
        const dbMock = createDbMock({ pivotRows, parteRows: [PARTE_A] });
        window.electronAPI = dbMock;

        const { result } = renderHook(() => usePartesCaso(CASE_ID, { skipInitialFetch: true }));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.partesCaso).toHaveLength(1);
        expect(result.current.partesCaso[0].id).toBe(PARTE_A.id);
        expect(getPartesByCaso).not.toHaveBeenCalled();
        expect(dbMock.db.deleteWhere).not.toHaveBeenCalled();
        expect(dbMock.db.upsertMany).not.toHaveBeenCalled();
    });

    it('si la API falla y la caché también falla, expone error y no isStale', async () => {
        window.electronAPI = {
            db: {
                getAll: vi.fn().mockRejectedValue(new Error('SQLite error')),
                upsertMany: vi.fn(),
                deleteWhere: vi.fn(),
                clearTable: vi.fn(),
            },
            logs: {
                debug: vi.fn().mockResolvedValue(true),
                info: vi.fn().mockResolvedValue(true),
                warn: vi.fn().mockResolvedValue(true),
                error: vi.fn().mockResolvedValue(true),
            },
        };
        getPartesByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBeTruthy();
        expect(result.current.isStale).toBe(false);
        expect(result.current.partesCaso).toHaveLength(0);
    });

    it('si la caché está vacía para el caso, retorna array vacío con isStale (no error)', async () => {
        // Hay partes en DB pero ninguna vinculada a este caso
        const dbMock = createDbMock({ pivotRows: [], parteRows: [PARTE_A] });
        window.electronAPI = dbMock;
        getPartesByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.partesCaso).toHaveLength(0);
        expect(result.current.isStale).toBe(true);
        expect(result.current.error).toBeNull();
    });

    it('hook sin caseId no intenta cargar datos', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;

        const { result } = renderHook(() => usePartesCaso(null));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.partesCaso).toHaveLength(0);
        expect(getPartesByCaso).not.toHaveBeenCalled();
    });
});

describe('usePartesCaso — linkParte', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('linkParte llama a la API y hace upsert del nuevo pivot', async () => {
        const dbMock = createDbMock();
        window.electronAPI = dbMock;
        getPartesByCaso.mockResolvedValue([]);
        linkParteToCaso.mockResolvedValue({ ok: true });
        // reload tras link
        getPartesByCaso.mockResolvedValueOnce([]).mockResolvedValueOnce([PARTE_A]);

        const { result } = renderHook(() => usePartesCaso(CASE_ID));
        await waitFor(() => expect(result.current.loading).toBe(false));

        dbMock.db.upsertMany.mockClear();

        await act(async () => {
            await result.current.linkParte(PARTE_A.id);
        });

        expect(linkParteToCaso).toHaveBeenCalledWith(CASE_ID, PARTE_A.id);
        expect(dbMock.db.upsertMany).toHaveBeenCalledWith('parte_caso', [
            { parte_id: PARTE_A.id, suit_case_id: CASE_ID },
        ]);
    });
});
