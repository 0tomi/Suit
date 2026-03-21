import { test, expect } from '@playwright/test';
import { ensureLoggedIn, launchElectronApp, waitForPageReady } from './helpers/electronTestUtils.js';

test('Agenda startup does not log outdated JSX transform warning', async () => {
    const warnings = [];
    const { electronApp, window } = await launchElectronApp({
        prefix: 'suit-test-jsx-runtime-warning',
        appEnv: {
            SUITAPP_RENDERER_MODE: 'dist',
        },
    });

    window.on('console', message => {
        if (message.type() === 'warning' || message.type() === 'error') {
            warnings.push(message.text());
        }
    });

    try {
        await ensureLoggedIn(window);
        await waitForPageReady(window, 'agenda');
        await window.waitForTimeout(1000);

        const jsxWarnings = warnings.filter(message => /outdated jsx transform/i.test(message));
        expect(jsxWarnings).toEqual([]);
    } finally {
        await electronApp.close();
    }
});
