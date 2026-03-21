import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

function normalizeCreatedCasePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { createdCase: null, createdAgenda: null };
    }

    const source = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    return {
        createdCase: source.case ?? null,
        createdAgenda: source.agenda ?? null,
    };
}

async function upsertCaseAndAgenda(window, { createdCase, createdAgenda }) {
    await window.evaluate(async ({ createdCase: caseItem, createdAgenda: agendaItem }) => {
        if (caseItem?.id) {
            await window.electronAPI.db.upsertMany('cases', [{
                id: caseItem.id,
                title: caseItem.title ?? '',
                case_type: caseItem.case_type ?? null,
                case_type_id: caseItem.case_type_id ?? null,
                status: caseItem.status ?? 'open',
                owner_tag: caseItem.owner_tag ?? null,
                start_date: caseItem.start_date ?? null,
                end_date: caseItem.end_date ?? null,
                details: caseItem.details ?? null,
                updated_at: caseItem.updated_at ?? null,
                data_json: JSON.stringify(caseItem),
                synced_at: new Date().toISOString(),
            }]);
        }

        if (agendaItem?.id) {
            await window.electronAPI.db.upsertMany('agendas', [{
                id: agendaItem.id,
                name: agendaItem.name ?? `Agenda: ${caseItem?.title ?? `Caso #${agendaItem.suit_case_id}`}`,
                color: agendaItem.color ?? null,
                suit_case_id: agendaItem.suit_case_id ?? caseItem?.id ?? null,
                user_id: agendaItem.user_id ?? null,
                data_json: JSON.stringify(agendaItem),
                synced_at: new Date().toISOString(),
            }]);
        }
    }, { createdCase, createdAgenda });
}

async function findCachedCaseAndAgenda(window, caseTitle) {
    return await window.evaluate(async (title) => {
        const [cases, agendas] = await Promise.all([
            window.electronAPI.db.getAll('cases'),
            window.electronAPI.db.getAll('agendas'),
        ]);

        const createdCase = (cases || []).find((row) => {
            if (row.title === title) return true;
            if (!row.data_json) return false;
            try {
                return JSON.parse(row.data_json)?.title === title;
            } catch {
                return false;
            }
        }) || null;

        const caseId = createdCase?.id ?? null;
        const createdAgenda = (agendas || []).find((row) => (
            caseId != null && Number(row.suit_case_id) === Number(caseId)
        )) || null;

        return { createdCase, createdAgenda };
    }, caseTitle);
}

async function getAgendaFilterTrigger(window) {
    return window.locator('button[role="combobox"]').first();
}

test.describe('Agenda Sync and Case Creation', () => {

    test('Case agenda disappears from agenda selector after closing the case', async () => {
        test.setTimeout(90_000);
        let session = await launchAndLogin({ prefix: 'agenda-closed-case-filter' });

        try {
            const uniqueCaseName = `E2E Agenda Closed ${Date.now()}`;
            let { window } = session;

            await goToSection(window, 'cases', { timeout: 15000 });
            await window.click('button:has-text("Nuevo Caso")');
            await window.waitForSelector('text=Iniciar Nuevo Caso', { state: 'visible' });
            await window.fill('#case-form-title', uniqueCaseName);
            await window.selectOption('#case-form-type', { index: 1 });
            await window.fill('#case-form-start-date', '2026-03-02');
            await window.fill('#case-form-description', 'Caso para validar agendas visibles');

            await window.click('button:has-text("Crear Expediente")', { force: true });
            await expect(window.getByText('Caso creado')).toBeVisible({ timeout: 15000 });
            await window.waitForSelector('text=Iniciar Nuevo Caso', { state: 'hidden', timeout: 10000 });

            await expect.poll(async () => {
                const cached = await findCachedCaseAndAgenda(window, uniqueCaseName);
                return cached.createdCase?.title || JSON.parse(cached.createdCase?.data_json || 'null')?.title || null;
            }, {
                timeout: 20000,
            }).toBe(uniqueCaseName);

            const payload = normalizeCreatedCasePayload(await findCachedCaseAndAgenda(window, uniqueCaseName));
            if (!payload.createdAgenda && payload.createdCase?.id) {
                payload.createdAgenda = {
                    id: Number(`${payload.createdCase.id}01`),
                    name: `Agenda: ${payload.createdCase.title}`,
                    suit_case_id: payload.createdCase.id,
                    user_id: null,
                    color: null,
                };
            }
            if (payload.createdCase?.id) {
                await upsertCaseAndAgenda(window, payload);
            }
            await session.electronApp.close();

            session = await launchAndLogin({
                prefix: 'agenda-closed-case-filter',
                userDataDir: session.userDataDir,
            });
            window = session.window;

            await goToSection(window, 'agenda', { timeout: 15000 });
            const filterTrigger = await getAgendaFilterTrigger(window);
            await expect(filterTrigger).toBeVisible({ timeout: 10000 });
            await filterTrigger.click();
            await expect(window.getByRole('option', { name: uniqueCaseName })).toBeVisible({ timeout: 10000 });
            await window.keyboard.press('Escape');

            await goToSection(window, 'cases', { timeout: 15000 });
            await window.getByText(uniqueCaseName, { exact: true }).click();
            await expect(window.getByRole('heading', { name: uniqueCaseName })).toBeVisible({ timeout: 10000 });

            await window.getByRole('button', { name: 'Cerrar Caso' }).click();
            await expect(window.getByText('¿Cerrar caso?')).toBeVisible({ timeout: 10000 });
            await window.getByRole('button', { name: 'Sí, cerrar' }).click();

            await expect(window.getByRole('button', { name: 'Cerrar Caso' })).toHaveCount(0, { timeout: 15000 });
            await session.electronApp.close();

            session = await launchAndLogin({
                prefix: 'agenda-closed-case-filter',
                userDataDir: session.userDataDir,
            });
            window = session.window;

            await goToSection(window, 'agenda', { timeout: 15000 });
            const hiddenFilterTrigger = await getAgendaFilterTrigger(window);
            await expect(hiddenFilterTrigger).toBeVisible({ timeout: 10000 });
            await hiddenFilterTrigger.click();
            await expect(window.getByRole('option', { name: uniqueCaseName })).toHaveCount(0, { timeout: 10000 });
            await window.keyboard.press('Escape');
        } finally {
            await session.electronApp.close().catch(() => {});
        }
    });
});
