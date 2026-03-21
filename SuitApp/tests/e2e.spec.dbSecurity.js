import { test, expect } from '@playwright/test';
import { launchElectronApp } from './helpers/electronTestUtils.js';

test.describe('IPC DB Security', () => {
    test('should reject non-whitelisted table names and columns', async () => {
        const { electronApp, window } = await launchElectronApp({ prefix: 'suit-test-db-security' });

        try {
            const invalidTable = await window.evaluate(async () => {
                try {
                    await window.electronAPI.db.getAll('users; DROP TABLE users; --');
                    return { ok: true, message: null };
                } catch (err) {
                    return { ok: false, message: String(err?.message || err) };
                }
            });

            expect(invalidTable.ok).toBe(false);
            expect(invalidTable.message).toContain('Invalid table');

            const invalidColumn = await window.evaluate(async () => {
                try {
                    await window.electronAPI.db.upsertMany('users', [{ id: -1, bad_column: 'x' }]);
                    return { ok: true, message: null };
                } catch (err) {
                    return { ok: false, message: String(err?.message || err) };
                }
            });

            expect(invalidColumn.ok).toBe(false);
            expect(invalidColumn.message).toContain('Invalid column');

            const validCamelCaseColumn = await window.evaluate(async () => {
                try {
                    await window.electronAPI.db.upsertMany('case_types', [{
                        id: -1,
                        name: 'Tipo temporal',
                        description: 'prueba',
                        eventColor: '#10b981',
                        data_json: '{}',
                        synced_at: new Date().toISOString(),
                    }]);
                    return { ok: true, message: null };
                } catch (err) {
                    return { ok: false, message: String(err?.message || err) };
                }
            });

            expect(validCamelCaseColumn.ok).toBe(true);

            // La tabla legítima debe seguir accesible tras intentos inválidos.
            const validUsers = await window.evaluate(async () => {
                const rows = await window.electronAPI.db.getAll('users');
                return Array.isArray(rows);
            });
            expect(validUsers).toBe(true);
        } finally {
            await electronApp.close();
        }
    });
});
