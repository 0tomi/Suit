import path from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';

const MAX_CONSOLE_ENTRIES = 40;
const MAX_BODY_TEXT_LENGTH = 4000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const SLOW_TEST_RATIO = 0.8;

function truncateText(value, limit = MAX_BODY_TEXT_LENGTH) {
    const text = String(value || '').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
}

function sanitizeSegment(value) {
    return String(value || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'unknown';
}

function formatDuration(durationMs) {
    return `${(durationMs / 1000).toFixed(1)}s`;
}

function buildTestLabel(testInfo) {
    return [path.basename(testInfo.file || 'unknown'), testInfo.title].filter(Boolean).join(' > ');
}

async function safeWriteJson(targetPath, payload) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function safeRemove(targetPath) {
    await rm(targetPath, { force: true }).catch(() => null);
}

/**
 * Diagnóstico reutilizable para E2E en Electron.
 * Registra pasos, heartbeat, consola reciente y adjunta artefactos útiles
 * sólo cuando el test falla o consume casi todo su presupuesto.
 */
export function createE2ETestDiagnostics({
    window,
    testInfo,
    featureTag = 'e2e',
    dbTables = [],
}) {
    const startedAt = Date.now();
    const testLabel = buildTestLabel(testInfo);
    const stepTimings = [];
    const consoleEntries = [];
    const liveStatePath = path.join(
        process.cwd(),
        'test-results',
        '.live',
        `${sanitizeSegment(featureTag)}-${sanitizeSegment(testInfo.file)}-${sanitizeSegment(testInfo.title)}-r${testInfo.retry}.json`,
    );

    let currentStep = 'init';
    let traceStarted = false;
    let heartbeatTimer = null;

    const emit = (prefix, details = '') => {
        const suffix = details ? ` ${details}` : '';
        console.log(`[${prefix}] ${testLabel}${suffix}`);
    };

    const pushConsoleEntry = (entry) => {
        consoleEntries.push(entry);
        if (consoleEntries.length > MAX_CONSOLE_ENTRIES) {
            consoleEntries.shift();
        }
    };

    const getLatestConsoleSummary = () => {
        const latest = consoleEntries.at(-1);
        if (!latest) return 'none';
        return `${latest.type}:${truncateText(latest.text, 180)}`;
    };

    const writeLiveState = async (reason = 'update') => {
        const payload = {
            reason,
            featureTag,
            title: testInfo.title,
            file: testInfo.file,
            retry: testInfo.retry,
            timeoutMs: testInfo.timeout,
            currentStep,
            elapsedMs: Date.now() - startedAt,
            stepTimings,
            latestConsoleEntry: consoleEntries.at(-1) || null,
            timestamp: new Date().toISOString(),
        };

        await safeWriteJson(liveStatePath, payload);
    };

    const onConsole = (msg) => {
        pushConsoleEntry({
            type: msg.type(),
            text: msg.text(),
            ts: new Date().toISOString(),
        });
    };

    const onPageError = (error) => {
        pushConsoleEntry({
            type: 'pageerror',
            text: error?.message || String(error),
            ts: new Date().toISOString(),
        });
    };

    const onCrash = () => {
        pushConsoleEntry({
            type: 'crash',
            text: 'Renderer crashed',
            ts: new Date().toISOString(),
        });
    };

    window.on('console', onConsole);
    window.on('pageerror', onPageError);
    window.on('crash', onCrash);

    async function init() {
        if (!traceStarted) {
            await window.context().tracing.start({
                screenshots: true,
                snapshots: true,
            });
            traceStarted = true;
        }

        emit('DIAG:INIT', `timeout=${testInfo.timeout}ms`);
        await writeLiveState('init');

        heartbeatTimer = setInterval(() => {
            const elapsedMs = Date.now() - startedAt;
            emit(
                'HEARTBEAT',
                `elapsed=${formatDuration(elapsedMs)} step=${currentStep} last=${getLatestConsoleSummary()}`,
            );
            void writeLiveState('heartbeat');
        }, HEARTBEAT_INTERVAL_MS);
    }

    async function runStep(stepName, callback) {
        currentStep = stepName;
        const stepStartedAt = Date.now();

        emit('STEP:START', `step=${stepName}`);
        await writeLiveState('step-start');

        try {
            return await callback();
        } finally {
            const durationMs = Date.now() - stepStartedAt;
            stepTimings.push({
                name: stepName,
                durationMs,
            });

            emit('STEP:END', `step=${stepName} duration=${formatDuration(durationMs)}`);
            await writeLiveState('step-end');
        }
    }

    async function collectDbSnapshot() {
        if (!Array.isArray(dbTables) || dbTables.length === 0) {
            return null;
        }

        return await window.evaluate(async (tables) => {
            if (!window.electronAPI?.db?.getAll) return null;

            const snapshot = {};
            for (const table of tables) {
                try {
                    const rows = await window.electronAPI.db.getAll(table);
                    snapshot[table] = Array.isArray(rows) ? rows.length : null;
                } catch (error) {
                    snapshot[table] = {
                        error: error?.message || String(error),
                    };
                }
            }

            return snapshot;
        }, dbTables).catch(() => null);
    }

    async function collectPageState() {
        const [url, documentTitle, bodyText, sectionTitle, dbSnapshot] = await Promise.all([
            window.url().catch(() => null),
            window.title().catch(() => null),
            window.locator('body').innerText().catch(() => ''),
            window.evaluate(() => {
                const visibleTitle = Array.from(document.querySelectorAll('[data-testid$="-title"]'))
                    .find((node) => {
                        const element = /** @type {HTMLElement} */ (node);
                        return element.offsetParent !== null;
                    });
                return visibleTitle?.textContent?.trim() || null;
            }).catch(() => null),
            collectDbSnapshot(),
        ]);

        return {
            url,
            documentTitle,
            sectionTitle,
            bodyText: truncateText(bodyText),
            dbSnapshot,
        };
    }

    async function attachArtifacts(reason) {
        const durationMs = Date.now() - startedAt;
        const pageState = await collectPageState();
        const payload = {
            reason,
            status: testInfo.status,
            expectedStatus: testInfo.expectedStatus,
            timeoutMs: testInfo.timeout,
            durationMs,
            currentStep,
            stepTimings,
            consoleEntries,
            ...pageState,
        };

        const contextPath = testInfo.outputPath(`${featureTag}-context-${reason}.json`);
        await safeWriteJson(contextPath, payload);
        await testInfo.attach(`${featureTag}-context-${reason}`, {
            path: contextPath,
            contentType: 'application/json',
        });

        const screenshotPath = testInfo.outputPath(`${featureTag}-${reason}.png`);
        await window.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
        await testInfo.attach(`${featureTag}-screenshot-${reason}`, {
            path: screenshotPath,
            contentType: 'image/png',
        }).catch(() => null);

        if (traceStarted) {
            const tracePath = testInfo.outputPath(`${featureTag}-${reason}.zip`);
            await window.context().tracing.stop({ path: tracePath }).catch(() => null);
            traceStarted = false;
            await testInfo.attach(`${featureTag}-trace-${reason}`, {
                path: tracePath,
                contentType: 'application/zip',
            }).catch(() => null);
        }
    }

    async function finalize() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }

        const durationMs = Date.now() - startedAt;
        const failed = testInfo.status !== testInfo.expectedStatus;
        const slow = durationMs >= Math.floor(testInfo.timeout * SLOW_TEST_RATIO);

        if (failed) {
            emit(
                'TEST:FAIL',
                `step=${currentStep} duration=${formatDuration(durationMs)} last=${getLatestConsoleSummary()}`,
            );
            await attachArtifacts('failure');
        } else if (slow) {
            emit(
                'TEST:SLOW',
                `step=${currentStep} duration=${formatDuration(durationMs)} last=${getLatestConsoleSummary()}`,
            );
            await attachArtifacts('slow');
        } else if (traceStarted) {
            await window.context().tracing.stop().catch(() => null);
            traceStarted = false;
        }

        window.off('console', onConsole);
        window.off('pageerror', onPageError);
        window.off('crash', onCrash);
        await safeRemove(liveStatePath);
    }

    return {
        init,
        runStep,
        finalize,
        writeLiveState,
    };
}
