import { getTemplate } from '../templateService.js';
import { getTemplateRequirementsLastModified } from '../templateService.js';
import { isServerUpToDate, getLocalLaravelTime } from './syncCore.js';
import { createLogger } from '../logService.js';
import { normalizeTemplateRequirements } from '../../utils/templateRequirements.js';

const logger = createLogger('sync:template-requirements');

function buildRequirementRows(templateId, requirements) {
    return normalizeTemplateRequirements(requirements).map((r) => ({
        template_id: templateId,
        requisito_id: r.requisito_id,
        id_campo: r.id_campo,
        NEntidad: r.NEntidad ?? 1,
        note: r.note ?? null,
        deleted_at: null,
        synced_at: new Date().toISOString(),
    }));
}

/**
 * Devuelve los requisitos de una plantilla con estrategia cache-friendly.
 *
 * Escenario A — sin caché:
 *   Trae el detalle de la plantilla desde la API, extrae los requirements,
 *   los devuelve al frontend y los persiste en paralelo en plantilla_requisitos.
 *
 * Escenario B.2.c — con caché y sin cambios:
 *   Devuelve directo desde la tabla local sin tocar la API.
 *
 * Escenario B.2.a — con caché pero con cambios detectados:
 *   Re-fetcha los requirements, los devuelve y actualiza el caché en paralelo.
 *
 * La sync_meta para esta entidad usa la clave `template_requirements:{templateId}`
 * para no colisionar con otras entradas globales.
 *
 * @param {number} templateId
 * @returns {Promise<Array<{id, id_campo, requisito_id, type, title}>>}
 */
export async function getTemplateRequirements(templateId) {
    const metaKey = `template_requirements:${templateId}`;

    // Intentar obtener el caché actual
    const cached = await window.electronAPI.db.getTemplateRequirements(templateId);

    if (!cached || cached.length === 0) {
        // Escenario A: sin caché → fetch completo
        return await fetchAndCacheTemplateRequirements(templateId, metaKey);
    }

    // Escenario B: hay caché → verificar si hay cambios
    const meta = await window.electronAPI.sync.getMeta(metaKey);
    const serverTimestamp = await getTemplateRequirementsLastModified(templateId);

    if (!serverTimestamp) {
        // No se pudo consultar el servidor (offline) → devolver caché
        logger.warn('no se pudo consultar last-modified, usando caché', { templateId });
        return cached;
    }

    if (isServerUpToDate(serverTimestamp, meta?.last_server)) {
        // Escenario B.2.c: sin cambios → devolver caché
        logger.info('requisitos sin cambios, usando caché', { templateId });
        return cached;
    }

    // Escenario B.2.a: hay cambios → actualizar
    logger.info('cambios detectados, re-sincronizando requisitos', { templateId });
    return await fetchAndCacheTemplateRequirements(templateId, metaKey);
}

/**
 * Fetch del detalle de la plantilla, extracción de requirements y persistencia en caché.
 * Devuelve los requirements inmediatamente y persiste en paralelo.
 * @param {number} templateId
 * @param {string} metaKey - Clave de sync_meta para esta plantilla
 */
async function fetchAndCacheTemplateRequirements(templateId, metaKey) {
    const templateDetail = await getTemplate(templateId);

    if (!templateDetail) {
        logger.error('no se pudo obtener detalle de plantilla', { templateId });
        return [];
    }

    // La API devuelve { data: { ..., requirements: [...] } }
    const template = templateDetail.data ?? templateDetail;
    const requirements = normalizeTemplateRequirements(template.requirements);

    if (requirements.length === 0) {
        logger.info('plantilla sin requisitos', { templateId });
        // Limpiar caché obsoleto si lo hubiera
        void persistTemplateRequirements(templateId, [], metaKey);
        return [];
    }

    // Construir filas para plantilla_requisitos
    // Persistir en paralelo sin bloquear la respuesta al frontend
    void persistTemplateRequirements(templateId, requirements, metaKey);

    // Devolver en el mismo formato que getTemplateRequirements (JOIN aplana type/title)
    return requirements;
}

/**
 * Persiste los requirements en SQLite y actualiza sync_meta.
 * Se llama de forma fire-and-forget (void) para no bloquear la respuesta al frontend.
 * @param {number} templateId
 * @param {Array} requirements - Requisitos normalizados de la plantilla
 * @param {string} metaKey
 */
export async function replaceCachedTemplateRequirements(templateId, requirements, metaKey = `template_requirements:${templateId}`) {
    const rows = buildRequirementRows(templateId, requirements);

    // Limpiar requirements anteriores de esta plantilla antes de reinsertar
    await window.electronAPI.db.deleteWhere('plantilla_requisitos', { template_id: templateId });

    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('plantilla_requisitos', rows);
    }

    const now = getLocalLaravelTime();
    await window.electronAPI.sync.setMeta(metaKey, now, now);

    return rows;
}

async function persistTemplateRequirements(templateId, requirements, metaKey) {
    try {
        const rows = await replaceCachedTemplateRequirements(templateId, requirements, metaKey);
        logger.info('caché de requisitos actualizado', { templateId, count: rows.length });
    } catch (err) {
        logger.error('error persistiendo requisitos en caché', { templateId, err: err?.message });
    }
}
