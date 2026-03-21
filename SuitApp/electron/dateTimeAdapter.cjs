/**
 * Adapter de fechas para el proceso main (Electron).
 *
 * Convención interna:
 *   - SQLite almacena `starts_at` como ISO 8601 *naive* (sin zona horaria):
 *     "2026-04-15T09:30:00"  →  se interpreta como hora local del sistema.
 *   - La API envía/recibe UTC con sufijo Z:
 *     "2026-04-15T09:30:00.000000Z"
 *
 * Esto permite al abogado ver y editar siempre en hora local sin conversiones,
 * asumiendo que el despacho opera en una única zona horaria.
 */

const ISO_NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Extrae los componentes de fecha/hora de un string ISO (con o sin timezone)
 * y devuelve un string naive local: "YYYY-MM-DDTHH:mm:ss".
 * Nunca hace conversión de zona horaria — el valor se trata como hora local.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function fromApiDateTime(value) {
    if (!value) return null;
    const raw = String(value).trim();

    const match = ISO_NAIVE_RE.exec(raw);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds = '00'] = match;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function fromApiStartsAt(value) {
    return fromApiDateTime(value);
}

/**
 * Añade el sufijo "Z" a un string naive para enviarlo a la API como UTC.
 * La app trata la hora local del despacho como UTC a nivel de API.
 *
 * @param {string|null|undefined} naiveIso
 * @returns {string|null}
 */
function toApiDateTime(naiveIso) {
    if (!naiveIso) return null;
    const raw = String(naiveIso).trim();
    if (!raw) return null;
    if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
        return raw;
    }
    return `${raw}Z`;
}

function toApiStartsAt(naiveIso) {
    return toApiDateTime(naiveIso);
}

/**
 * Construye un objeto Date local a partir de un starts_at naive.
 * Usa el constructor con partes explícitas para evitar que JS interprete
 * el string como UTC al parsear con `new Date(str)`.
 *
 * @param {string|null|undefined} naiveIso
 * @returns {Date|null}
 */
function buildLocalDateFromNaiveIso(naiveIso) {
    if (!naiveIso) return null;
    const raw = String(naiveIso).trim();
    const match = ISO_NAIVE_RE.exec(raw);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds = '0'] = match;
    const built = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
        0,
    );
    return Number.isNaN(built.getTime()) ? null : built;
}

function buildLocalDateFromStartsAt(naiveIso) {
    return buildLocalDateFromNaiveIso(naiveIso);
}

/**
 * Calcula el `notify_at` local restando `minutesBefore` al `starts_at` del evento.
 * Devuelve un string naive local (mismo formato que `starts_at` en SQLite).
 *
 * @param {string} startsAt  - starts_at naive del evento en SQLite
 * @param {number} minutesBefore - minutos antes del evento para notificar
 * @returns {string|null}
 */
function calcNotifyAt(startsAt, minutesBefore) {
    const eventDate = buildLocalDateFromNaiveIso(startsAt);
    if (!eventDate) return null;

    const minutes = Number(minutesBefore);
    if (!Number.isFinite(minutes) || minutes < 0) return null;

    const notifyDate = new Date(eventDate.getTime() - minutes * 60 * 1000);
    if (Number.isNaN(notifyDate.getTime())) return null;

    const y = notifyDate.getFullYear();
    const mo = String(notifyDate.getMonth() + 1).padStart(2, '0');
    const d = String(notifyDate.getDate()).padStart(2, '0');
    const h = String(notifyDate.getHours()).padStart(2, '0');
    const mi = String(notifyDate.getMinutes()).padStart(2, '0');
    const s = String(notifyDate.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/**
 * Calcula cuántos minutos antes del evento está el notify_at.
 * Útil para reconstruir la configuración "X minutos antes" desde la BD.
 *
 * @param {string} startsAt  - starts_at naive del evento
 * @param {string} notifyAt  - notify_at naive de la notificación
 * @returns {number|null}
 */
function calcMinutesFromStartsAt(startsAt, notifyAt) {
    const eventDate = buildLocalDateFromNaiveIso(startsAt);
    const notifyDate = buildLocalDateFromNaiveIso(notifyAt);
    if (!eventDate || !notifyDate) return null;

    const diffMs = eventDate.getTime() - notifyDate.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    return diffMinutes >= 0 ? diffMinutes : null;
}

module.exports = {
    fromApiDateTime,
    fromApiStartsAt,
    toApiDateTime,
    toApiStartsAt,
    buildLocalDateFromNaiveIso,
    buildLocalDateFromStartsAt,
    calcNotifyAt,
    calcMinutesFromStartsAt,
};
