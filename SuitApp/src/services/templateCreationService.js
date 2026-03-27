import { createTemplate, updateTemplate } from './templateService.js';
import { createLogger } from './logService.js';
import { getLocalLaravelTime } from './sync/syncCore.js';
import { normalizeTemplateRequirements } from '../utils/templateRequirements.js';

const logger = createLogger('template-creation');

/**
 * Construye la fila a persistir en la tabla `templates` a partir del objeto
 * devuelto por la API tras un POST/PUT.
 */
function buildTemplateRow(template) {
    return {
        id: template.id,
        title: template.title ?? null,
        template_category_id: template.template_category_id ?? null,
        data_json: JSON.stringify(template),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Construye las filas a persistir en `plantilla_requisitos` a partir del array
 * `requirements` que devuelve la API (formato: [{ id, id_campo, requisito_id, type, title }]).
 */
function buildRequirementRows(templateId, requirements) {
    return normalizeTemplateRequirements(requirements).map((r) => ({
        template_id: templateId,
        requisito_id: r.requisito_id,
        id_campo: r.id_campo,     // INTEGER: número del placeholder #n#
        NEntidad: r.NEntidad ?? 1,
        note: r.note ?? null,
        deleted_at: null,
        synced_at: new Date().toISOString(),
    }));
}

/**
 * Persiste la plantilla y sus requisitos en el caché local (SQLite).
 * Limpia los requisitos previos para ese template_id antes de reinsertar.
 * También actualiza sync_meta para evitar un re-fetch innecesario en el próximo uso.
 *
 * @param {Object} template - Objeto de plantilla devuelto por la API (con requirements[])
 */
async function cacheTemplateWithRequirements(template) {
    const templateId = template.id;
    const requirements = normalizeTemplateRequirements(template.requirements);

    // Persistir template en caché
    await window.electronAPI.db.upsertMany('templates', [buildTemplateRow(template)]);

    // Persistir requirements en caché (limpiar previos primero)
    await window.electronAPI.db.deleteWhere('plantilla_requisitos', { template_id: templateId });
    if (requirements.length > 0) {
        const rows = buildRequirementRows(templateId, requirements);
        await window.electronAPI.db.upsertMany('plantilla_requisitos', rows);
    }

    // Actualizar sync_meta para no disparar un re-sync innecesario
    const now = getLocalLaravelTime();
    await window.electronAPI.sync.setMeta(`template_requirements:${templateId}`, now, now);
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Crea una nueva plantilla en la API y la cachea localmente junto con sus requisitos.
 *
 * El frontend pasa el body HTML con #n# placeholders y el array de requirements.
 * La API registra la plantilla y la tabla pivot en un solo POST; nosotros cacheamos
 * el resultado inmediatamente para que `useTemplates()` la refleje sin necesidad de sync.
 *
 * @param {Object} data
 * @param {string} data.title
 * @param {string} data.content                 - HTML con #n# placeholders
 * @param {number} [data.template_category_id]
 * @param {Array<{id_requisito: number, id_campo: number, NEntidad: number}>} [data.requirements]
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function createTemplateWithRequirements(data) {
    try {
        const result = await createTemplate(data);
        if (!result.ok) {
            logger.error('error al crear plantilla en la API', { error: result.error });
            return { ok: false, error: result.error };
        }

        const template = result.data?.data ?? result.data;
        if (template?.id) {
            // Cachear en paralelo sin bloquear la respuesta al frontend
            void cacheTemplateWithRequirements(template).catch((err) =>
                logger.warn('error al cachear plantilla creada', { err: err?.message })
            );
        }

        return { ok: true, data: template };
    } catch (err) {
        logger.error('excepción al crear plantilla', { err: err?.message });
        return { ok: false, error: err?.message };
    }
}

/**
 * Actualiza una plantilla existente en la API y sincroniza el caché local.
 *
 * Si se incluye `requirements`, la API reemplaza todos los requisitos vinculados.
 * El caché local se actualiza de la misma forma.
 *
 * @param {number} templateId
 * @param {Object} data
 * @param {string} [data.title]
 * @param {string} [data.content]
 * @param {number} [data.template_category_id]
 * @param {Array<{id_requisito: number, id_campo: number, NEntidad: number}>} [data.requirements]
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function updateTemplateWithRequirements(templateId, data) {
    try {
        const result = await updateTemplate(templateId, data);
        if (!result.ok) {
            logger.error('error al actualizar plantilla en la API', { templateId, error: result.error });
            return { ok: false, error: result.error };
        }

        const template = result.data?.data ?? result.data;
        if (template?.id) {
            void cacheTemplateWithRequirements(template).catch((err) =>
                logger.warn('error al cachear plantilla actualizada', { err: err?.message })
            );
        }

        return { ok: true, data: template };
    } catch (err) {
        logger.error('excepción al actualizar plantilla', { templateId, err: err?.message });
        return { ok: false, error: err?.message };
    }
}
