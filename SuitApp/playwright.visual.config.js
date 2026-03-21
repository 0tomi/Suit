import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: 'e2e.spec.notificationsVisual.js',
    workers: 1,
    timeout: 90_000,
});
