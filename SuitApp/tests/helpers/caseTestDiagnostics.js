import { createE2ETestDiagnostics } from './e2eDiagnostics.js';

/**
 * Wrapper específico para Casos.
 * Conserva el detalle de tablas SQLite que ya era útil en este dominio.
 */
export function createCaseTestDiagnostics({ window, testInfo }) {
    return createE2ETestDiagnostics({
        window,
        testInfo,
        featureTag: 'case-test',
        dbTables: ['cases', 'agendas', 'events', 'documents'],
    });
}
