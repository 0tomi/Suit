import dayjs from 'dayjs';
import { test, expect } from '@playwright/test';
import { launchAndLogin, waitForPageReady } from './helpers/electronTestUtils.js';

const MONTH_NAMES_ES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];

async function goToMonthViaYearView(window, targetDate) {
    const yearViewButton = window.getByRole('button', { name: 'Año', exact: true });
    const todayButton = window.getByRole('button', { name: 'Hoy', exact: true }).first();
    const prevButton = todayButton.locator('xpath=preceding-sibling::button[1]');
    const nextButton = todayButton.locator('xpath=following-sibling::button[1]');
    const toolbarLabel = window.locator('div.ml-4.text-lg.font-bold').first();

    await yearViewButton.click();

    const targetYear = targetDate.year();
    for (let i = 0; i < 12; i += 1) {
        const labelText = (await toolbarLabel.textContent()) || '';
        const currentYear = Number(labelText.replace(/[^\d]/g, ''));
        if (currentYear === targetYear) break;
        if (!Number.isFinite(currentYear)) break;
        if (currentYear < targetYear) {
            await nextButton.click();
        } else {
            await prevButton.click();
        }
        await window.waitForTimeout(250);
    }

    const monthName = MONTH_NAMES_ES[targetDate.month()];
    await window.locator('h3', { hasText: monthName }).first().click();
    await window.waitForTimeout(500);
}

async function hasLocalEventForMonth(window, titlePrefix, monthPart) {
    return await window.evaluate(async ({ titlePrefix, monthPart }) => {
        const rows = await window.electronAPI.db.getAll('events');
        return rows.some((row) => {
            let title = row.title;
            let startsAt = row.starts_at;

            if ((!title || !startsAt) && row.data_json) {
                try {
                    const parsed = JSON.parse(row.data_json);
                    title = title || parsed?.title;
                    startsAt = startsAt || parsed?.starts_at;
                } catch {
                    return false;
                }
            }

            const normalizedDate = String(startsAt || '').split('T')[0];
            return String(title || '').startsWith(titlePrefix) && normalizedDate.startsWith(monthPart);
        });
    }, { titlePrefix, monthPart });
}

test.describe('Agenda Monthly Visibility', () => {
    test('user test can view seeded past and future month events', async () => {
        const { electronApp, window } = await launchAndLogin({
            prefix: 'suit-agenda-range-visibility',
            credentials: { username: 'test', password: 'testtest' },
        });

        try {
            await waitForPageReady(window, 'agenda', { timeout: 20000 });
            await window.locator('button', { hasText: 'Mes' }).click();

            const pastDate = dayjs().subtract(2, 'month');
            const futureDate = dayjs().add(3, 'month');
            const pastMonthPart = pastDate.format('YYYY-MM');
            const futureMonthPart = futureDate.format('YYYY-MM');
            const agendaViewButton = window.getByRole('button', { name: 'Agenda', exact: true });
            const monthViewButton = window.getByRole('button', { name: 'Mes', exact: true });

            await goToMonthViaYearView(window, pastDate);
            await agendaViewButton.click();
            await expect.poll(
                () => hasLocalEventForMonth(window, 'E2E CURL PAST', pastMonthPart),
                { timeout: 20000 },
            ).toBe(true);
            await monthViewButton.click();

            await goToMonthViaYearView(window, futureDate);
            await agendaViewButton.click();
            await expect.poll(
                () => hasLocalEventForMonth(window, 'E2E CURL FUTURE', futureMonthPart),
                { timeout: 20000 },
            ).toBe(true);
        } finally {
            await electronApp.close();
        }
    });
});
