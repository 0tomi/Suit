import { test, expect } from '@playwright/test';
import { launchElectronApp } from './helpers/electronTestUtils.js';

test('Electron boots after database facade refactor', async () => {
    const { electronApp, window } = await launchElectronApp({ prefix: 'db-bootstrap' });

    try {
        await expect.poll(async () => {
            const [hasSetup, hasLogin, hasAgenda, url] = await Promise.all([
                window.getByTestId('server-setup-modal').count(),
                window.getByTestId('login-submit').count(),
                window.getByTestId('page-agenda-title').count(),
                window.url(),
            ]);

            return {
                hasRenderableScreen: hasSetup > 0 || hasLogin > 0 || hasAgenda > 0,
                isChromeError: url.startsWith('chrome-error://'),
            };
        }, {
            timeout: 20000,
        }).toEqual({
            hasRenderableScreen: true,
            isChromeError: false,
        });
    } finally {
        await electronApp.close();
    }
});
