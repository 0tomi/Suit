import { spawn } from 'node:child_process';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const testResultsDir = path.join(projectRoot, 'test-results');

const BATTERIES = {
    changed: {
        timeoutMs: 16 * 60 * 1000,
        specs: [
            'tests/e2e.spec.agendaCrud.js',
            'tests/e2e.spec.agendaMonthlyRange.js',
            'tests/e2e.spec.agendaSync.js',
            'tests/e2e.spec.cacheResync.js',
            'tests/e2e.spec.databaseFacade.js',
            'tests/e2e.spec.deadlines.js',
            'tests/e2e.spec.notificationModal.js',
            'tests/e2e.spec.notificationsFix.js',
            'tests/e2e.spec.notificationsToday.js',
        ],
    },
    agenda: {
        timeoutMs: 18 * 60 * 1000,
        specs: [
            'tests/e2e.spec.agenda.js',
            'tests/e2e.spec.agendaColorPersonal.js',
            'tests/e2e.spec.agendaCrud.js',
            'tests/e2e.spec.agendaDateMigration.js',
            'tests/e2e.spec.agendaModalError.js',
            'tests/e2e.spec.agendaMonthlyRange.js',
            'tests/e2e.spec.agendaSync.js',
        ],
    },
    notifications: {
        timeoutMs: 12 * 60 * 1000,
        specs: [
            'tests/e2e.spec.notificationModal.js',
            'tests/e2e.spec.notifications.js',
            'tests/e2e.spec.notificationsFix.js',
            'tests/e2e.spec.notificationsToday.js',
        ],
    },
    'data-cache': {
        timeoutMs: 12 * 60 * 1000,
        specs: [
            'tests/e2e.spec.cacheResync.js',
            'tests/e2e.spec.cacheSync.js',
            'tests/e2e.spec.databaseBootstrap.js',
            'tests/e2e.spec.databaseFacade.js',
            'tests/e2e.spec.dbSecurity.js',
            'tests/e2e.spec.userIsolation.js',
        ],
    },
    workspace: {
        timeoutMs: 18 * 60 * 1000,
        specs: [
            'tests/e2e.spec.casesPage.js',
            'tests/e2e.spec.clientsAndDocuments.js',
            'tests/e2e.spec.clientsFilterRefactor.js',
            'tests/e2e.spec.documentEdit.js',
            'tests/e2e.spec.editorToolbar.js',
            'tests/e2e.spec.deadlines.js',
        ],
    },
    'shell-settings': {
        timeoutMs: 12 * 60 * 1000,
        specs: [
            'tests/e2e.spec.adminImprovements.js',
            'tests/e2e.spec.checkTitle.js',
            'tests/e2e.spec.jsxRuntimeWarning.js',
            'tests/e2e.spec.settings.js',
            'tests/e2e.spec.tutorial.js',
        ],
    },
};

const ALL_BATTERIES = ['agenda', 'notifications', 'data-cache', 'workspace', 'shell-settings'];

/**
 * Devuelve el comando de Playwright envuelto con display virtual en Linux.
 */
function buildPlaywrightInvocation(specs, timeoutMs) {
    const playwrightArgs = [
        'playwright',
        'test',
        ...specs,
        '--config=playwright.config.js',
        '--workers=1',
        '--max-failures=1',
        `--global-timeout=${timeoutMs}`,
    ];

    if (process.platform === 'linux') {
        return {
            command: 'xvfb-run',
            args: ['-a', '-s', '-screen 0 1920x1080x24', npxBin, ...playwrightArgs],
        };
    }

    return {
        command: npxBin,
        args: playwrightArgs,
    };
}

/**
 * Mata el grupo completo del proceso para evitar Electron/Xvfb zombies.
 */
function killProcessTree(pid, signal) {
    if (!pid) return;

    try {
        if (process.platform !== 'win32') {
            process.kill(-pid, signal);
            return;
        }
        process.kill(pid, signal);
    } catch (error) {
        if (error?.code !== 'ESRCH') {
            throw error;
        }
    }
}

async function readLatestLiveState() {
    const liveDir = path.join(testResultsDir, '.live');
    const filenames = await readdir(liveDir).catch(() => []);

    let latest = null;

    for (const filename of filenames) {
        const fullPath = path.join(liveDir, filename);
        const info = await stat(fullPath).catch(() => null);
        if (!info?.isFile()) continue;

        if (!latest || info.mtimeMs > latest.mtimeMs) {
            latest = {
                fullPath,
                mtimeMs: info.mtimeMs,
            };
        }
    }

    if (!latest) return null;

    const raw = await readFile(latest.fullPath, 'utf8').catch(() => null);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function printLatestLiveState(name) {
    const state = await readLatestLiveState();
    if (!state) {
        console.error(`[battery:${name}] No live test state was captured before timeout.`);
        return;
    }

    const elapsedSeconds = ((state.elapsedMs ?? 0) / 1000).toFixed(1);
    const latestConsoleText = state.latestConsoleEntry?.text || 'none';

    console.error(
        `[battery:${name}] Last live state: ${state.file ?? 'unknown'} > ${state.title ?? 'unknown'} | step=${state.currentStep ?? 'unknown'} | elapsed=${elapsedSeconds}s | latest-log=${latestConsoleText}`,
    );
}

/**
 * Ejecuta una batería con timeout de Playwright y watchdog externo.
 */
async function runBattery(name) {
    const battery = BATTERIES[name];
    if (!battery) {
        throw new Error(`Unknown battery "${name}".`);
    }

    await rm(testResultsDir, { recursive: true, force: true }).catch(() => null);

    const { command, args } = buildPlaywrightInvocation(battery.specs, battery.timeoutMs);
    const hardTimeoutMs = battery.timeoutMs + 30_000;

    console.log(`\n[battery:${name}] START ${new Date().toISOString()} — Running ${battery.specs.length} specs (budget ${Math.round(battery.timeoutMs / 60000)}m)\n`);

    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: projectRoot,
            stdio: 'inherit',
            env: { ...process.env },
            detached: process.platform !== 'win32',
        });

        let forcedExitCode = null;
        let killEscalationTimer = null;

        const hardTimeoutTimer = setTimeout(() => {
            forcedExitCode = 124;
            console.error(`\n[battery:${name}] ⚠ HARD TIMEOUT after ${hardTimeoutMs}ms at ${new Date().toISOString()}`);
            console.error(`[battery:${name}] Specs in this battery: ${battery.specs.join(', ')}`);
            void printLatestLiveState(name);
            killProcessTree(child.pid, 'SIGTERM');
            killEscalationTimer = setTimeout(() => {
                killProcessTree(child.pid, 'SIGKILL');
            }, 5000);
        }, hardTimeoutMs);

        child.on('exit', async (code, signal) => {
            clearTimeout(hardTimeoutTimer);
            if (killEscalationTimer) clearTimeout(killEscalationTimer);

            if (forcedExitCode != null) {
                await printLatestLiveState(name);
                console.log(`[battery:${name}] END ${new Date().toISOString()} — exit code: HARD TIMEOUT`);
                resolve(forcedExitCode);
                return;
            }

            if (signal) {
                console.error(`[battery:${name}] Exited by signal ${signal}.`);
                console.log(`[battery:${name}] END ${new Date().toISOString()} — exit code: ${signal}`);
                resolve(1);
                return;
            }

            console.log(`[battery:${name}] END ${new Date().toISOString()} — exit code: ${code ?? 1}`);
            resolve(code ?? 1);
        });
    });
}

async function main() {
    const target = process.argv[2] ?? 'all';
    const selected = target === 'all' ? ALL_BATTERIES : [target];
    const unknown = selected.find((name) => !BATTERIES[name]);

    if (unknown) {
        console.error(`Unknown battery "${unknown}". Available: ${['all', ...Object.keys(BATTERIES)].join(', ')}`);
        process.exit(1);
    }

    for (const name of selected) {
        const exitCode = await runBattery(name);
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
