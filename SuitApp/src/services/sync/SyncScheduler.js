/**
 * SyncScheduler — cola de prioridad con concurrencia limitada para sincronizaciones.
 *
 * Problema que resuelve: al hacer login, los ~21 contextos con autoRefreshOnMount:true
 * disparan syncFn() simultáneamente, generando ~126-189 llamadas IPC al proceso main
 * de Electron. better-sqlite3 es síncrono y se congestiona con ese volumen concurrente.
 *
 * Solución: un scheduler singleton que regula cuántas syncs corren al mismo tiempo
 * (MAX_CONCURRENT = 3) y las ejecuta por orden de prioridad.
 *
 * Ciclo de vida por sesión:
 *   1. Contextos montan → registran su syncFn vía register()
 *   2. AuthContext detecta login → llama start(clearStaleResources)
 *      - start() marca state.starting = true → requestSync() encola pero no drena
 *      - clearStaleResources() corre sin interferencia de syncs
 *      - state.started = true → _drain() libera la cola
 *   3. Requests que llegan durante "starting" se acumulan y drenan al terminar
 *   4. En logout: reset() limpia la cola y baja los flags
 *
 * Prioridades:
 *   TIER_CRITICAL (1) — datos visibles al login: cases, clients, events
 *   TIER_STANDARD (2) — datos operativos: documents, templates, deadlines, users
 *   TIER_CATALOG  (3) — catálogos de referencia: roles, tipos, jurisdicciones, etc.
 */

export const TIER_CRITICAL = 1;
export const TIER_STANDARD = 2;
export const TIER_CATALOG = 3;

/** Máximo de syncs corriendo simultáneamente. Valor conservador para no saturar IPC. */
const MAX_CONCURRENT = 3;

/** Promesa del start() en curso para garantizar idempotencia entre llamadas concurrentes. */
let _startPromise = null;

/**
 * Estado interno del scheduler. Se resetea en cada logout vía reset().
 */
const state = {
    /** Map<resourceName, { syncFn, priority }> */
    registrations: new Map(),
    /** Map<resourceName, { promise, resolve, reject, priority }> */
    pending: new Map(),
    /** Map<resourceName, Promise<void>> */
    active: new Map(),
    /** true mientras drain() está en ejecución para evitar reentrancia */
    draining: false,
    /**
     * "starting" = clearStaleResources en curso: requestSync() encola pero no drena.
     * "started"  = listo para drenar.
     * Ninguno    = pre-login: requestSync() ejecuta directo sin cola.
     */
    starting: false,
    started: false,
};

/**
 * Registra un recurso en el scheduler.
 * Los contextos deben llamar a esto en su useEffect de mount.
 * @param {string} resourceName
 * @param {() => Promise<void>} syncFn
 * @param {number} priority — TIER_CRITICAL | TIER_STANDARD | TIER_CATALOG
 */
export function register(resourceName, syncFn, priority = TIER_STANDARD) {
    state.registrations.set(resourceName, { syncFn, priority });
}

/**
 * Elimina el registro de un recurso. Llamar en el cleanup del useEffect.
 * @param {string} resourceName
 */
export function unregister(resourceName) {
    state.registrations.delete(resourceName);
}

/**
 * Solicita la sincronización de un recurso.
 *
 * Comportamiento según el estado del scheduler:
 * - Pre-login (ni started ni starting): ejecuta syncFn directamente (cubre refreshes
 *   manuales post-mutation antes del primer login).
 * - "starting" (clearStaleResources en curso): encola pero NO drena todavía.
 * - "started": encola y drena inmediatamente (respetando MAX_CONCURRENT).
 *
 * Deduplicación: si el recurso ya está activo o pendiente, retorna la promesa existente.
 *
 * @param {string} resourceName
 * @returns {Promise<void>}
 */
export function requestSync(resourceName) {
    // Dedup: ya está corriendo
    if (state.active.has(resourceName)) {
        return state.active.get(resourceName);
    }
    // Dedup: ya está en cola
    if (state.pending.has(resourceName)) {
        return state.pending.get(resourceName).promise;
    }

    const reg = state.registrations.get(resourceName);
    if (!reg) return Promise.resolve();

    // Pre-login: sin scheduler activo, ejecutar directo
    if (!state.started && !state.starting) {
        return reg.syncFn();
    }

    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    state.pending.set(resourceName, { promise, resolve, reject, priority: reg.priority });

    // Solo drenar si ya terminó el período de "starting"
    if (state.started) _drain();
    return promise;
}

/**
 * Inicia el scheduler para una nueva sesión.
 * Idempotente: múltiples llamadas concurrentes retornan la misma promesa.
 *
 * Secuencia:
 *   1. Marca state.starting = true → requestSync() empieza a encolar
 *   2. Ejecuta clearStaleResourcesFn (si se provee)
 *   3. Marca state.started = true, state.starting = false
 *   4. Drena la cola de pendientes
 *
 * @param {() => Promise<void>} [clearStaleResourcesFn]
 * @returns {Promise<void>}
 */
export function start(clearStaleResourcesFn) {
    // Ya completó el startup de esta sesión
    if (state.started) return Promise.resolve();
    // Ya hay un start en progreso: retornar la misma promesa
    if (_startPromise) return _startPromise;

    state.starting = true;

    _startPromise = (async () => {
        if (typeof clearStaleResourcesFn === 'function') {
            try {
                await clearStaleResourcesFn();
            } catch (err) {
                // clearStaleResources falla silenciosamente: no bloquea el startup
                console.warn('[SyncScheduler] clearStaleResources failed:', err);
            }
        }
        state.started = true;
        state.starting = false;
        _drain();
    })();

    return _startPromise;
}

/**
 * Resetea el scheduler al estado inicial. Llamar en logout.
 * Limpia la cola y baja los flags, pero preserva las registrations (los contextos
 * siguen montados y vuelven a re-registrarse en el próximo login via start()).
 */
export function reset() {
    state.pending.clear();
    state.active.clear();
    state.draining = false;
    state.started = false;
    state.starting = false;
    _startPromise = null;
}

/**
 * Retorna una promesa que se resuelve cuando toda la cola esté vacía.
 * Útil para tests.
 * @returns {Promise<void>}
 */
export function flush() {
    if (state.pending.size === 0 && state.active.size === 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (state.pending.size === 0 && state.active.size === 0) {
                clearInterval(check);
                resolve();
            }
        }, 50);
    });
}

/**
 * Selecciona el recurso pendiente con menor número de prioridad (más urgente).
 * En caso de empate usa el orden de inserción del Map (FIFO).
 * @returns {string | null}
 */
function _pickHighestPriority() {
    let best = null;
    let bestPriority = Infinity;
    for (const [name, entry] of state.pending) {
        if (entry.priority < bestPriority) {
            bestPriority = entry.priority;
            best = name;
        }
    }
    return best;
}

/**
 * Motor interno: despacha tareas pendientes mientras haya slots disponibles.
 * No es reentrante: la flag draining previene llamadas anidadas.
 */
function _drain() {
    if (state.draining) return;
    state.draining = true;

    while (state.pending.size > 0 && state.active.size < MAX_CONCURRENT) {
        const name = _pickHighestPriority();
        if (!name) break;

        const { resolve, reject } = state.pending.get(name);
        state.pending.delete(name);

        const reg = state.registrations.get(name);
        if (!reg) {
            resolve();
            continue;
        }

        const syncPromise = reg.syncFn()
            .then(resolve, reject)
            .finally(() => {
                state.active.delete(name);
                // Al liberar un slot, intentar despachar el siguiente
                _drain();
            });

        state.active.set(name, syncPromise);
    }

    state.draining = false;
}

const SyncScheduler = { register, unregister, requestSync, start, reset, flush };
export default SyncScheduler;
