import { test, expect } from '@playwright/test';
import { launchElectronApp } from './helpers/electronTestUtils.js';

test('App starts and shows title', async () => {
    const { electronApp, window } = await launchElectronApp({ prefix: 'suit-test-check-title' });

    try {
        const title = await window.title();
        expect(title).toBe('Suit');
    } finally {
        await electronApp.close();
    }
});
