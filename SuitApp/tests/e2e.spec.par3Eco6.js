/**
 * Feature: ECO-6
 *
 * Riesgo cubierto:
 * - Si el detalle del caso abre Economía con honorarios/gastos cacheados y la API falla
 *   únicamente para esos endpoints, la UI debe seguir mostrando las filas cacheadas.
 *
 * Nota:
 * - La cobertura E2E de PAR-3 quedó bloqueada por datos del entorno para el usuario `test`
 *   y se documenta aparte en `docs/TASK.md`.
 */

import { test, expect } from '@playwright/test';
import { launchAndLogin } from './helpers/electronTestUtils.js';

function unwrapCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

function buildApiUrl({ host, port }, endpoint) {
    return `http://${host}:${port}/api${endpoint}`;
}

async function getApiConfig(page) {
    return page.evaluate(async () => ({
        host: await window.electronAPI.config.get('api_host'),
        port: await window.electronAPI.config.get('api_port'),
        token: await window.electronAPI.config.get('auth_token'),
    }));
}

async function apiRequest(apiConfig, endpoint, { method = 'GET', body } = {}) {
    const response = await fetch(buildApiUrl(apiConfig, endpoint), {
        method,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const rawText = await response.text();
    let data = null;

    try {
        data = rawText ? JSON.parse(rawText) : null;
    } catch {
        data = rawText || null;
    }

    return {
        ok: response.ok,
        status: response.status,
        data,
    };
}

async function ensureCase(apiConfig) {
    const [caseTypesResponse, radicacionesResponse] = await Promise.all([
        apiRequest(apiConfig, '/case-types'),
        apiRequest(apiConfig, '/radicaciones'),
    ]);

    const caseTypes = unwrapCollection(caseTypesResponse.data);
    const radicaciones = unwrapCollection(radicacionesResponse.data);

    if (caseTypes.length === 0 || radicaciones.length === 0) {
        throw new Error('No hay case types o radicaciones disponibles para sembrar el fixture de ECO-6.');
    }

    const uniqueKey = Date.now();
    const payload = {
        title: `PW ECO6 ${uniqueKey}`,
        start_date: new Date().toISOString().split('T')[0],
        nro_expediente: `PW-ECO6-${uniqueKey}`,
        radicacion_id: radicaciones[0].id,
        case_type_id: caseTypes[0].id,
        details: 'Fixture temporal para fallback offline de Economía.',
    };

    const response = await apiRequest(apiConfig, '/cases', {
        method: 'POST',
        body: payload,
    });

    const createdCase = response.data?.case ?? response.data?.data ?? response.data ?? null;
    const createdCaseId = createdCase?.id ?? null;
    if (!response.ok || !createdCaseId) {
        throw new Error(`No se pudo crear el caso fixture de ECO-6. Status=${response.status}`);
    }

    return {
        caseId: createdCaseId,
        caseTitle: createdCase?.title ?? payload.title,
    };
}

async function cleanupCaseFixture(apiConfig, fixture) {
    if (!fixture?.caseId) return;
    await apiRequest(apiConfig, `/cases/${fixture.caseId}`, { method: 'DELETE' }).catch(() => null);
}

async function openCaseDetail(page, caseId, caseTitle) {
    const origin = await page.evaluate(() => window.location.origin);
    await page.goto(`${origin}/cases/${caseId}`);
    await expect(page.getByRole('heading', { name: caseTitle })).toBeVisible({ timeout: 15000 });
}

async function seedEconomiaCache(page, fixture) {
    await page.evaluate(async ({ caseId, caseTitle, timestamp }) => {
        const honorarioRow = {
            id: 900001,
            suit_case_id: caseId,
            client_id: 123456,
            monto: 2500,
            detalles: 'Honorario cacheado para modo offline',
            pagado: 0,
            total_entregas: 0,
            synced_at: timestamp,
            data_json: JSON.stringify({
                id: 900001,
                suit_case_id: caseId,
                monto: 2500,
                pagado: false,
                detalles: 'Honorario cacheado para modo offline',
                created_at: timestamp,
                client: {
                    id: 123456,
                    first_name: 'Cache',
                    last_name: 'Honorario',
                },
                suit_case: {
                    id: caseId,
                    title: caseTitle,
                },
            }),
        };

        const gastoRow = {
            id: 900002,
            gasto_id: 654321,
            suit_case_id: caseId,
            monto: 875,
            client_ids: JSON.stringify([123456]),
            synced_at: timestamp,
            data_json: JSON.stringify({
                id: 900002,
                gasto_id: 654321,
                suit_case_id: caseId,
                monto: 875,
                created_at: timestamp,
                gasto: {
                    id: 654321,
                    titulo: 'Gasto Cacheado Offline',
                },
                suit_case: {
                    id: caseId,
                    title: caseTitle,
                },
            }),
        };

        await window.electronAPI.db.upsertMany('honorarios', [honorarioRow]);
        await window.electronAPI.db.upsertMany('gasto_suit_cases', [gastoRow]);
    }, fixture);
}

async function patchEconomiaRequestsOffline(page, caseId) {
    await page.evaluate((currentCaseId) => {
        const originalRequest = window.electronAPI.http.request;
        const honorariosUrlFragment = `/suit-cases/${currentCaseId}/honorarios`;
        const gastosUrlFragment = `/suit-cases/${currentCaseId}/gastos`;

        window.__pwOriginalHttpRequest = originalRequest;
        window.electronAPI.http.request = async (payload) => {
            if (payload?.url?.includes(honorariosUrlFragment) || payload?.url?.includes(gastosUrlFragment)) {
                return {
                    ok: false,
                    status: 0,
                    data: null,
                    headers: {},
                    error: 'forced offline for ECO-6',
                };
            }

            return originalRequest(payload);
        };
    }, caseId);
}

async function restoreHttpPatch(page) {
    await page.evaluate(() => {
        if (window.__pwOriginalHttpRequest) {
            window.electronAPI.http.request = window.__pwOriginalHttpRequest;
            delete window.__pwOriginalHttpRequest;
        }
    });
}

test.describe('ECO-6', () => {
    let electronApp;
    let page;
    let apiConfig;
    let caseFixture;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-par3-eco6' }));
        apiConfig = await getApiConfig(page);
    });

    test.afterEach(async () => {
        await restoreHttpPatch(page).catch(() => null);
    });

    test.afterAll(async () => {
        await cleanupCaseFixture(apiConfig, caseFixture).catch(() => null);
        await electronApp?.close();
    });

    test('ECO-6: Economía de un caso mantiene honorarios y gastos cacheados si la API de esos endpoints falla', async () => {
        caseFixture = await ensureCase(apiConfig);
        await openCaseDetail(page, caseFixture.caseId, caseFixture.caseTitle);
        await seedEconomiaCache(page, {
            caseId: caseFixture.caseId,
            caseTitle: caseFixture.caseTitle,
            timestamp: new Date().toISOString(),
        });
        await patchEconomiaRequestsOffline(page, caseFixture.caseId);

        await page.getByRole('button', { name: 'Economía' }).click();

        await expect(page.getByText('Cache Honorario')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Gasto Cacheado Offline')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('No se encontraron honorarios para este caso.')).toHaveCount(0);
        await expect(page.getByText('No se encontraron gastos para este caso.')).toHaveCount(0);
    });
});
