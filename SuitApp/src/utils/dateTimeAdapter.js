/**
 * Adapter de fechas para el renderer (React/Vite).
 *
 * Convención interna:
 *   - SQLite almacena `starts_at` como ISO 8601 *naive* (sin zona horaria):
 *     "2026-04-15T09:30:00"  →  se interpreta como hora local del sistema.
 *   - La API envía/recibe UTC con sufijo Z:
 *     "2026-04-15T09:30:00.000000Z"
 *
 * La UI siempre trabaja con hora local. Nunca convierte timezones.
 */

const ISO_NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Extrae los componentes de fecha/hora de un string ISO (con o sin timezone)
 * y devuelve un string naive local: "YYYY-MM-DDTHH:mm:ss".
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function fromApiDateTime(value) {
    if (!value) return null;
    const raw = String(value).trim();

    const match = ISO_NAIVE_RE.exec(raw);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds = '00'] = match;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function fromApiStartsAt(value) {
    return fromApiDateTime(value);
}

/**
 * Añade el sufijo "Z" a un string naive para enviarlo a la API.
 *
 * @param {string|null|undefined} naiveIso
 * @returns {string|null}
 */
export function toApiDateTime(naiveIso) {
    if (!naiveIso) return null;
    const raw = String(naiveIso).trim();
    if (!raw) return null;
    if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;
    return `${raw}Z`;
}

export function toApiStartsAt(naiveIso) {
    return toApiDateTime(naiveIso);
}

export function buildLocalDateFromNaiveIso(value) {
    const normalized = fromApiDateTime(value);
    if (!normalized) return null;

    const match = ISO_NAIVE_RE.exec(normalized);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds = '00'] = match;
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

/**
 * Convierte un starts_at naive + is_all_day a los valores que espera el formulario HTML.
 *
 * @param {string|null} startsAt  - "YYYY-MM-DDTHH:mm:ss" (naive)
 * @param {boolean|number} isAllDay
 * @returns {{ dateInput: string, timeInput: string }}
 *   dateInput: "YYYY-MM-DD" (para <input type="date">)
 *   timeInput: "HH:mm"      (para <input type="time">) o "" si es todo el día
 */
export function toLocalInputValues(startsAt, isAllDay) {
    if (!startsAt) return { dateInput: '', timeInput: '' };

    const match = ISO_NAIVE_RE.exec(String(startsAt).trim());
    if (!match) return { dateInput: '', timeInput: '' };

    const [, year, month, day, hours, minutes] = match;
    const dateInput = `${year}-${month}-${day}`;
    const timeInput = isAllDay ? '' : `${hours}:${minutes}`;
    return { dateInput, timeInput };
}

/**
 * Convierte los valores del formulario HTML a starts_at naive + is_all_day.
 *
 * @param {string} dateInput  - "YYYY-MM-DD" (de <input type="date">)
 * @param {string} timeInput  - "HH:mm" (de <input type="time">) o "" para todo el día
 * @returns {{ starts_at: string, is_all_day: boolean }}
 */
export function fromFormValues(dateInput, timeInput) {
    const safeDate = String(dateInput || '').trim();
    const safeTime = String(timeInput || '').trim();

    if (!safeDate) {
        return { starts_at: null, is_all_day: !safeTime };
    }

    const isAllDay = !safeTime;
    const timePart = safeTime ? `${safeTime}:00` : '00:00:00';
    return {
        starts_at: `${safeDate}T${timePart}`,
        is_all_day: isAllDay,
    };
}

/**
 * Construye el payload que la API espera para crear/actualizar un evento.
 *
 * @param {object} params
 * @param {string} params.starts_at  - naive ISO del evento
 * @param {boolean} params.is_all_day
 * @param {string} params.title
 * @param {string|null} [params.description]
 * @param {number} params.agenda_id
 * @param {number|null} [params.suit_case_id]
 * @param {number} [params.event_type_id]
 * @returns {object}
 */
export function toApiEventPayload({
    starts_at,
    is_all_day,
    title,
    description = null,
    agenda_id,
    suit_case_id = null,
    event_type_id = 1,
}) {
    return {
        title,
        starts_at: toApiDateTime(starts_at),
        is_all_day: Boolean(is_all_day),
        description: description || null,
        agenda_id,
        suit_case_id,
        event_type_id,
    };
}
