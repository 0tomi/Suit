import { syncCaseDown } from './sync/caseSyncDownService.js';
import { getTemplateRequirements } from './sync/templateRequirementsSyncService.js';
import { createLogger } from './logService.js';
import { format, parseISO, parse, getYear, getMonth, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { numToWordsES, MONTH_NAMES_ES } from '../utils/numToWordsES.js';
import { applyCapitalization } from '../utils/templateCapitalization.js';

const logger = createLogger('template-filler');

/** Patrón de tag: #id_campo# — id_campo es un número (ej: #1#, #2#, #n#) */
const TAG_REGEX = /#([^#\s]+)#/g;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parsea el data_json de una fila SQLite y lo fusiona con los campos cacheados.
 * Necesario porque algunos campos se almacenan serializados en data_json.
 */
function parseRow(row) {
    if (!row) return null;
    if (!row.data_json) return row;
    try {
        return { ...row, ...JSON.parse(row.data_json) };
    } catch {
        return row;
    }
}

/**
 * Formatea un starts_at de evento a texto legible en español (dd/MM/yyyy HH:mm).
 * Si el valor es solo fecha (sin hora), omite la parte horaria.
 */
function formatEventDate(startsAt) {
    if (!startsAt) return '';
    try {
        const date = parseISO(startsAt.replace(' ', 'T'));
        const hasTime = startsAt.includes('T') || startsAt.includes(' ');
        return hasTime
            ? format(date, 'dd/MM/yyyy HH:mm', { locale: es })
            : format(date, 'dd/MM/yyyy', { locale: es });
    } catch {
        return startsAt;
    }
}

// ─── Mapa de resolvers por tipo de campo ──────────────────────────────────────

/**
 * Cada entrada indica:
 *   table   — tabla SQLite donde buscar la entidad por ID.
 *   extract — función que recibe la fila ya parseada y devuelve el valor string.
 *
 * Los tipos manuales (date, text, number, custom, etc.) no figuran aquí;
 * su valor lo envía el frontend directamente en fieldIds.
 */
const FIELD_RESOLVERS = {
    // ── Cliente ──────────────────────────────────────────────────────────────
    // Nombre completo con tratamiento: el motor prepende Sr./Sra. según el género registrado.
    // Ej: "Juan García" (M) → "Sr. Juan García"; "María González" (F) → "Sra. María González"
    clientCompleteName: {
        table: 'clients',
        extract: (r) => {
            const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
            const g = r.gender ?? r.genero ?? '';
            const prefix = g === 'F' ? 'Sra. ' : g === 'M' ? 'Sr. ' : '';
            return prefix + name;
        },
    },
    clientFirstName:      { table: 'clients', extract: (r) => r.first_name ?? '' },
    // El apellido siempre va acompañado del tratamiento (Sr./Sra.) cuando el género es conocido.
    // Ej: "García" con género M → "Sr. García"; con F → "Sra. García"
    clientLastName: {
        table: 'clients',
        extract: (r) => {
            const lastName = r.last_name ?? '';
            const g = r.gender ?? r.genero ?? '';
            const prefix = g === 'F' ? 'Sra. ' : g === 'M' ? 'Sr. ' : '';
            return prefix + lastName;
        },
    },
    clientIdentification: { table: 'clients', extract: (r) => r.identification_number ?? '' },
    clientAddress:        { table: 'clients', extract: (r) => r.address ?? '' },
    clientEmail:          { table: 'clients', extract: (r) => r.email ?? '' },
    clientPhone:          { table: 'clients', extract: (r) => r.phone ?? '' },

    // ── Usuario / Abogado ─────────────────────────────────────────────────────
    userCompleteName:     { table: 'users', extract: (r) => r.name ?? '' },
    userName:             { table: 'users', extract: (r) => r.name ?? '' },
    userLastName:         { table: 'users', extract: (r) => r.last_name ?? '' },
    userEmail:            { table: 'users', extract: (r) => r.email ?? '' },
    userRegistration:     { table: 'users', extract: (r) => r.tag ?? '' },
    userCuit:             { table: 'users', extract: (r) => r.cuit ?? '' },

    // ── Caso ──────────────────────────────────────────────────────────────────
    // Edge case: si el caso no está cacheado, resolveEntity dispara syncCaseDown.
    caseTitle:            { table: 'cases', extract: (r) => r.title ?? '' },
    caseNumber:           { table: 'cases', extract: (r) => r.nro_expediente ?? '' },
    caseStartDate:        { table: 'cases', extract: (r) => r.start_date ?? '' },
    caseEndDate:          { table: 'cases', extract: (r) => r.end_date ?? '' },

    // ── Sub-entidades del caso (cada una tiene su propio ID) ──────────────────
    caseType:             { table: 'case_types',              extract: (r) => r.name ?? '' },
    radicacion:           { table: 'radicaciones',            extract: (r) => r.name ?? '' },
    jurisdiccion:         { table: 'jurisdicciones',          extract: (r) => r.nombre ?? '' },
    competencia:          { table: 'competencias',            extract: (r) => r.fuero ?? '' },
    dependencia:          { table: 'dependencias_judiciales', extract: (r) => r.nombre_juzgado ?? '' },

    // ── Partes contrarias ─────────────────────────────────────────────────────
    parteCompleteName:    { table: 'partes', extract: (r) => [r.nombre, r.apellido].filter(Boolean).join(' ') },
    parteIdentification:  { table: 'partes', extract: (r) => r.identification ?? '' },
    parteAddress:         { table: 'partes', extract: (r) => r.address ?? '' },

    // ── Eventos ───────────────────────────────────────────────────────────────
    eventType:            { table: 'events', extract: (r) => r.type ?? '' },
    eventName:            { table: 'events', extract: (r) => r.title ?? '' },
    eventDate:            { table: 'events', extract: (r) => formatEventDate(r.starts_at) },

    // ── Tratamiento del cliente según género ──────────────────────────────────
    // Valores de la API: 'M' (masculino) → 'Sr.', 'F' (femenino) → 'Sra.', 'X' → 'señor'
    clientTreatment: {
        table: 'clients',
        extract: (r) => {
            const gender = r.gender ?? r.genero ?? '';
            if (gender === 'F') return 'Sra.';
            if (gender === 'M') return 'Sr.';
            return 'señor';
        },
    },
};

// ─── Helpers de parseo de fecha ───────────────────────────────────────────────

/**
 * Intenta parsear una fecha enviada por el frontend.
 * El frontend formatea como 'dd/MM/yyyy' (via fmtDate en UseTemplateModal).
 * Como fallback acepta formato ISO.
 */
function parseFrontendDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = parse(String(dateStr), 'dd/MM/yyyy', new Date());
        if (!isNaN(d.getTime())) return d;
    } catch { /* fallthrough */ }
    try {
        const d = parseISO(String(dateStr).replace(' ', 'T'));
        if (!isNaN(d.getTime())) return d;
    } catch { /* fallthrough */ }
    return null;
}

// ─── Resolvers derivados (valor viene del frontend, se transforma aquí) ───────

/**
 * Tipos que reciben un valor del frontend y lo transforman antes de insertar.
 * La función recibe el valor raw (string/number) y devuelve el string final.
 *
 * Fecha → partes: el frontend envía "dd/MM/yyyy"; el motor extrae año/mes/día.
 * Monto nombrado: el frontend envía el número; el motor convierte a palabras.
 */
const DERIVED_RESOLVERS = {
    // ── Partes de fecha (nombradas) ───────────────────────────────────────────
    anioNombrado: (v) => {
        const d = parseFrontendDate(v);
        return d ? numToWordsES(getYear(d)) : '';
    },
    mesNombrado: (v) => {
        const d = parseFrontendDate(v);
        return d ? MONTH_NAMES_ES[getMonth(d) + 1] ?? '' : '';
    },
    diaNombrado: (v) => {
        const d = parseFrontendDate(v);
        return d ? numToWordsES(getDate(d)) : '';
    },
    // ── Partes de fecha (numéricas) ───────────────────────────────────────────
    anioNumero: (v) => {
        const d = parseFrontendDate(v);
        return d ? String(getYear(d)) : '';
    },
    mesNumero: (v) => {
        const d = parseFrontendDate(v);
        return d ? String(getMonth(d) + 1) : '';
    },
    diaNumero: (v) => {
        const d = parseFrontendDate(v);
        return d ? String(getDate(d)) : '';
    },
    // ── Monto con símbolo ─────────────────────────────────────────────────────
    // Agrega el signo $ y el separador de miles con punto (formato argentino).
    // Ej: "1500" → "$ 1.500" | "1500000.50" → "$ 1.500.000,50"
    amount: (v) => {
        const raw = String(v).replace(/\s/g, '');
        const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
        if (isNaN(n)) return raw;
        // Formatear con Intl usando locale es-AR: punto como miles, coma como decimal
        const formatted = new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(n);
        return `$ ${formatted}`;
    },
    // ── Monto nombrado ────────────────────────────────────────────────────────
    // El frontend envía el valor numérico como string; se convierte a texto en español.
    montoNombrado: (v) => {
        const n = parseFloat(String(v).replace(/[$.]/g, '').replace(',', '.'));
        return isNaN(n) ? '' : numToWordsES(Math.floor(n));
    },
    // ── Fecha completa con mes nombrado ──────────────────────────────────────
    // El frontend envía "dd/MM/yyyy"; produce "día {n} de {mes} de {año}".
    // Ej: "15/03/2026" → "día 15 de marzo de 2026"
    fechaConMesNombrado: (v) => {
        const d = parseFrontendDate(v);
        if (!d) return '';
        const day   = getDate(d);
        const month = MONTH_NAMES_ES[getMonth(d) + 1] ?? '';
        const year  = getYear(d);
        return `día ${day} de ${month} de ${year}`;
    },
};

/**
 * Tipos que el frontend maneja directamente: el valor en fieldIds[id_campo]
 * ya es el string final, sin necesidad de resolver ninguna entidad.
 */
const MANUAL_TYPES = new Set([
    'text', 'number', 'date', 'dateTime', 'custom',
    'paymentType',
    'city', 'province', 'address',
]);

// ─── Concordancia de género ───────────────────────────────────────────────────

/**
 * Tabla de formas de género para artículos y demostrativos españoles.
 * Clave: forma normalizada (minúsculas). Valor: { M: forma_masc, F: forma_fem }.
 */
const GENDER_FORMS = {
    'el':       { M: 'el',      F: 'la'      },
    'la':       { M: 'el',      F: 'la'      },
    'un':       { M: 'un',      F: 'una'     },
    'una':      { M: 'un',      F: 'una'     },
    'del':      { M: 'del',     F: 'de la'   },
    'de la':    { M: 'del',     F: 'de la'   },
    'al':       { M: 'al',      F: 'a la'    },
    'a la':     { M: 'al',      F: 'a la'    },
    'este':     { M: 'este',    F: 'esta'    },
    'esta':     { M: 'este',    F: 'esta'    },
    'ese':      { M: 'ese',     F: 'esa'     },
    'esa':      { M: 'ese',     F: 'esa'     },
    'aquel':    { M: 'aquel',   F: 'aquella' },
    'aquella':  { M: 'aquel',   F: 'aquella' },
    'estos':    { M: 'estos',   F: 'estas'   },
    'estas':    { M: 'estos',   F: 'estas'   },
    'esos':     { M: 'esos',    F: 'esas'    },
    'esas':     { M: 'esos',    F: 'esas'    },
    'dicho':    { M: 'dicho',   F: 'dicha'   },
    'dicha':    { M: 'dicho',   F: 'dicha'   },
    'citado':   { M: 'citado',  F: 'citada'  },
    'citada':   { M: 'citado',  F: 'citada'  },
    'referido': { M: 'referido',F: 'referida'},
    'referida': { M: 'referido',F: 'referida'},
};

/**
 * Ajusta un artículo/demostrativo al género indicado preservando la capitalización original.
 *
 * Maneja tres variantes: TODO MAYÚSCULAS ("EL"), Primera Mayúscula ("El") y minúscula ("el").
 * Necesario para inicio de oración ("El #1# ha manifestado...") donde el artículo va en mayúscula.
 *
 * @param {string} article - Artículo original tal como aparece en el texto
 * @param {'M'|'F'} gender
 * @returns {string}
 */
function adjustArticle(article, gender) {
    const norm = article.toLowerCase().replace(/\s+/g, ' ').trim();
    const forms = GENDER_FORMS[norm];
    if (!forms) return article;

    const result = forms[gender] ?? article;

    // Detectar y preservar capitalización: TODO MAYÚSCULAS | Primera Mayúscula | minúscula
    const trimmed = article.trim();
    if (trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed)) {
        return result.toUpperCase();
    }
    if (trimmed[0] === trimmed[0].toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed[0])) {
        return result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
}

/**
 * Regex que captura un artículo/demostrativo antes de un tag #n#, con soporte para que
 * aparezca un tratamiento (Sr./Sra.) entre el artículo y el tag.
 *
 * Grupos:
 *   1 — artículo/demostrativo (ej: "el", "del", "este")
 *   2 — tratamiento opcional (ej: "Sr.", "Sra.") — puede estar ausente
 *   3 — id_campo numérico del tag
 *
 * Alternativas multi-palabra ("de la", "a la") van primero para evitar matches parciales.
 * Flag /gi: case-insensitive + global.
 *
 * Ejemplo de match: "del Sr. #1#" → groups: ["del", "Sr.", "1"]
 * Ejemplo de match: "el #2#"      → groups: ["el",  undefined, "2"]
 */
const ARTICLE_TAG_REGEX = /\b(aquella|aquel|estas|estos|esta|este|esas|esos|esa|ese|referida|referido|citada|citado|dicha|dicho|de\s+la|del|a\s+la|al|la|el|una|un)\s+(?:(Sr\.|Sra\.)\s+)?#(\d+)#/gi;

// ─── Resolución de entidades ──────────────────────────────────────────────────

/**
 * Obtiene una entidad desde SQLite usando una caché en memoria para evitar
 * fetches duplicados cuando varios campos apuntan a la misma entidad.
 *
 * Edge case: si la tabla es 'cases' y no está cacheada, dispara syncCaseDown
 * para descargarla antes de continuar (único caso que puede no estar en local).
 *
 * @param {string} table
 * @param {number|string} id
 * @param {Map} cache  - Acumulador { `${table}:${id}` → row|null }
 * @returns {Promise<Object|null>}
 */
async function resolveEntity(table, id, cache) {
    const key = `${table}:${id}`;
    if (cache.has(key)) return cache.get(key);

    let row = await window.electronAPI.db.getById(table, id);

    if (!row && table === 'cases') {
        logger.info('caso no cacheado, sincronizando', { id });
        await syncCaseDown(id);
        row = await window.electronAPI.db.getById('cases', id);
    }

    cache.set(key, row ?? null);
    return row ?? null;
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Retorna el body de una plantilla con todos los placeholders #n# eliminados.
 *
 * Útil cuando el usuario quiere ver o completar manualmente la plantilla
 * sin pasar por el flujo de autocompletado.
 *
 * @param {string} body - HTML con #n# placeholders
 * @returns {string} Body limpio, sin ninguna etiqueta #n#
 */
export function getEmptyTemplate(body) {
    if (!body) return '';
    return body.replace(TAG_REGEX, '');
}

/**
 * Rellena el cuerpo HTML de una plantilla reemplazando los tags #id_campo#
 * con los valores reales obtenidos desde la caché local.
 *
 * Los placeholders en el body son numéricos: #1#, #2#, ..., #n#.
 * Cada número corresponde al id_campo de un requisito de la plantilla.
 *
 * El frontend construye fieldIds como un mapa plano con claves numéricas:
 *   - Para campos de entidad: { [id_campo]: entityId }
 *     Ej: { 1: 3, 2: 3, 3: 12 }  (clientId=3, caseId=12)
 *   - Para campos manuales (date, text, number, custom, etc.): { [id_campo]: value }
 *     Ej: { 4: '15/03/2026', 5: 'texto libre' }
 *
 * Regla de agrupación para el frontend: varios id_campo del mismo tipo de entidad
 * (ej: clientCompleteName + clientAddress) comparten el mismo entityId — el frontend
 * muestra UN selector de cliente y aplica el mismo ID a todos esos campos.
 *
 * @param {Object} params
 * @param {number} params.templateId
 * @param {string} params.body          - HTML con #n# placeholders
 * @param {Object} [params.fieldIds]    - { [id_campo]: entityId | directValue }
 * @returns {Promise<string>} Body con placeholders reemplazados
 */
export async function fillTemplate({ templateId, body, fieldIds = {}, requirements: providedRequirements = null, capitalizationSettings = null, clientTreatmentEnabled = true }) {
    try {
        const requirements = Array.isArray(providedRequirements)
            ? providedRequirements
            : await getTemplateRequirements(templateId);
        if (requirements.length === 0) return body;

        // Caché en memoria para esta llamada (evita fetches duplicados)
        const entityCache = new Map();
        const resolved = {};

        await Promise.all(requirements.map(async ({ id_campo, type }) => {
            const rawValue = fieldIds[id_campo];
            if (rawValue === undefined || rawValue === null) return;

            // Tipos manuales: el frontend ya envía el valor final
            if (MANUAL_TYPES.has(type)) {
                resolved[id_campo] = applyCapitalization(String(rawValue), type, capitalizationSettings);
                return;
            }

            // Tipos derivados: el frontend envía un valor raw que se transforma aquí
            const derivedFn = DERIVED_RESOLVERS[type];
            if (derivedFn) {
                resolved[id_campo] = applyCapitalization(derivedFn(rawValue), type, capitalizationSettings);
                return;
            }

            // Tipos de entidad: rawValue es el ID de la entidad en la tabla
            const resolver = FIELD_RESOLVERS[type];
            if (!resolver) {
                logger.warn('tipo de campo sin resolver registrado', { type, id_campo });
                return;
            }

            const entity = await resolveEntity(resolver.table, rawValue, entityCache);
            if (entity) {
                let extracted = resolver.extract(parseRow(entity));

                // Si el tratamiento formal está desactivado, quitar el prefijo Sr./Sra.
                // que los resolvers de nombre completo y apellido agregan automáticamente.
                if (!clientTreatmentEnabled && (type === 'clientCompleteName' || type === 'clientLastName')) {
                    extracted = extracted.replace(/^(Sr\.|Sra\.)\s+/, '');
                }

                resolved[id_campo] = applyCapitalization(extracted, type, capitalizationSettings);
            }
        }));

        // ─── Mapa de género por id_campo ─────────────────────────────────────
        // Para campos de cliente, extrae el género de la entidad cacheada.
        // Se usa en la pasada de concordancia de artículos.
        const genderMap = {};
        for (const { id_campo, type } of requirements) {
            if (!type.startsWith('client')) continue;
            const clientId = fieldIds[id_campo];
            if (!clientId) continue;
            const entity = entityCache.get(`clients:${clientId}`);
            if (!entity) continue;
            const g = parseRow(entity)?.gender ?? parseRow(entity)?.genero ?? null;
            if (g === 'M' || g === 'F') genderMap[id_campo] = g;
        }

        // ─── Reemplazo en dos pasadas ────────────────────────────────────────
        // Pasada 1: artículo/demostrativo + (tratamiento opcional) + tag.
        //   Si el campo tiene género conocido, ajusta el artículo y el Sr./Sra. si estaba presente.
        //   Ej: "el #1#"      (clientCompleteName, F) → "la María García"
        //   Ej: "del Sr. #1#" (clientCompleteName, F) → "de la Sra. María García"
        // Pasada 2: tags restantes sin artículo precedente.
        let result = body.replace(ARTICLE_TAG_REGEX, (match, article, treatment, idCampo) => {
            const value = resolved[idCampo];
            if (value === undefined) return match;

            const gender = genderMap[idCampo];
            const fixedArticle = gender
                ? adjustArticle(article.replace(/\s+/g, ' ').trim(), gender)
                : article;

            const valueStr = String(value);

            // Si el Sr./Sra. ya está hardcodeado en el template Y el valor resuelto también
            // lo incluye (porque clientCompleteName/clientLastName lo agregan automáticamente),
            // omitimos el hardcodeado para evitar duplicados: "Sr. Sr. García" → "Sr. García".
            const valueAlreadyHasTreatment = /^(Sr\.|Sra\.)\s/i.test(valueStr);
            let fixedTreatment = '';
            if (treatment && !valueAlreadyHasTreatment) {
                fixedTreatment = (gender === 'F' ? 'Sra.' : gender === 'M' ? 'Sr.' : treatment) + ' ';
            }

            return `${fixedArticle} ${fixedTreatment}${valueStr}`;
        });

        // idCampo viene como string del regex → JS coerciona al buscar en resolved
        return result.replace(/#([^#\s]+)#/g, (match, idCampo) => {
            const value = resolved[idCampo];
            return value !== undefined ? String(value) : match;
        });
    } catch (err) {
        logger.error('error al rellenar plantilla', { templateId, err: err?.message });
        return body;
    }
}
