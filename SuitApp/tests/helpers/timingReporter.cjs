/**
 * timingReporter.cjs
 *
 * Reporter Playwright con salida breve y útil para diagnóstico.
 * Complementa los logs [STEP:*] y [HEARTBEAT] emitidos por e2eDiagnostics.
 */

const SLOW_THRESHOLD_MS = 24000;

function truncateText(value, limit = 220) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
}

/**
 * Devuelve la hora actual formateada como HH:MM:SS.
 */
function nowTime() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

class TimingReporter {
    constructor() {
        /** @type {Array<{title: string, spec: string, durationMs: number}>} */
        this.slowTests = [];
        /** @type {Map<string, {step: string | null, heartbeat: string | null}>} */
        this.liveTests = new Map();
    }

    buildKey(test) {
        return test.titlePath().filter(Boolean).join(' > ');
    }

    parseDiagnosticStdout(text) {
        const trimmed = String(text || '').trim();
        if (!trimmed) return null;

        const stepMatch = trimmed.match(/\[STEP:START\].* step=([a-z0-9._-]+)/i);
        if (stepMatch) {
            return { kind: 'step', value: stepMatch[1] };
        }

        if (trimmed.includes('[HEARTBEAT]') || trimmed.includes('[TEST:FAIL]')) {
            return { kind: 'heartbeat', value: truncateText(trimmed) };
        }

        return null;
    }

    /**
     * Se invoca al comenzar cada test. Imprime el título y la hora de inicio.
     * @param {import('@playwright/test/reporter').TestCase} test
     * @param {import('@playwright/test/reporter').TestResult} result
     */
    onTestBegin(test, result) {
        const title = this.buildKey(test);
        this.liveTests.set(title, { step: null, heartbeat: null });
        console.log(`[TEST:START] ${title} @ ${nowTime()} retry=${result.retry} timeout=${test.timeout}ms`);
    }

    /**
     * Captura la última señal emitida por el helper de diagnóstico del test.
     * @param {string|Buffer} chunk
     * @param {import('@playwright/test/reporter').TestCase|void} test
     */
    onStdOut(chunk, test) {
        if (!test) return;

        const parsed = this.parseDiagnosticStdout(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk);
        if (!parsed) return;

        const key = this.buildKey(test);
        const current = this.liveTests.get(key) || { step: null, heartbeat: null };

        if (parsed.kind === 'step') {
            current.step = parsed.value;
        }

        if (parsed.kind === 'heartbeat') {
            current.heartbeat = parsed.value;
        }

        this.liveTests.set(key, current);
    }

    /**
     * Se invoca al terminar cada test. Imprime la duración y avisa si fue lento.
     * @param {import('@playwright/test/reporter').TestCase} test
     * @param {import('@playwright/test/reporter').TestResult} result
     */
    onTestEnd(test, result) {
        const title = this.buildKey(test);
        const durationMs = result.duration;
        const seconds = (durationMs / 1000).toFixed(1);
        const isSlow = durationMs > SLOW_THRESHOLD_MS;
        const slowMark = isSlow ? ' — [SLOW ⚠]' : '';
        const liveState = this.liveTests.get(title) || { step: null, heartbeat: null };

        console.log(`[TEST:END] ${title} — ${seconds}s — status=${result.status}${slowMark}`);

        if (isSlow) {
            this.slowTests.push({
                title,
                spec: test.location?.file ?? 'unknown',
                durationMs,
            });
        }

        if (result.status !== test.expectedStatus) {
            const attachments = result.attachments
                .map((attachment) => attachment.path)
                .filter(Boolean)
                .map((attachmentPath) => truncateText(attachmentPath, 260));
            const errorSummary = truncateText(result.error?.message || result.error?.stack || 'No error details');

            console.log(`[TEST:FAIL] ${title} — step=${liveState.step || 'unknown'} — ${errorSummary}`);

            if (liveState.heartbeat) {
                console.log(`[TEST:FAIL:LAST] ${liveState.heartbeat}`);
            }

            if (attachments.length > 0) {
                console.log(`[TEST:ARTIFACTS] ${attachments.join(' | ')}`);
            }
        }

        this.liveTests.delete(title);
    }

    /**
     * Se invoca al finalizar toda la suite. Imprime el resumen de tests lentos.
     * @param {import('@playwright/test/reporter').FullResult} result
     */
    onEnd(result) {
        const durationSec = ((result.duration ?? 0) / 1000).toFixed(1);
        console.log(`\n[TimingReporter] Suite finished in ${durationSec}s — status: ${result.status}`);

        if (this.slowTests.length === 0) {
            console.log('[TimingReporter] No slow tests detected.');
            return;
        }

        console.log(`\n[TimingReporter] SLOW TESTS (>${SLOW_THRESHOLD_MS}ms):`);
        for (const t of this.slowTests) {
            const sec = (t.durationMs / 1000).toFixed(1);
            console.log(`  [SLOW ⚠] ${t.title} — ${sec}s — ${t.spec}`);
        }
    }
}

module.exports = TimingReporter;
