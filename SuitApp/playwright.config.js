import { defineConfig } from '@playwright/test';

const useDistRenderer = process.env.PLAYWRIGHT_USE_DIST === '1';

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.*.js',
    workers: 1, // Electron apps often require single-worker execution to avoid port conflicts
    timeout: 90000, // 90s para cubrir startup Electron (~35s) + login + navegación en beforeAll
    outputDir: 'test-results',
    reporter: [['list'], ['./tests/helpers/timingReporter.cjs']],
    webServer: useDistRenderer ? undefined : {
        command: 'npm run dev',
        port: 5173,
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
    },
});
