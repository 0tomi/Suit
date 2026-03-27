/**
 * templatePreviewService.js — Carga de plantillas para vista previa con estrategia cache-first.
 *
 * La galería trabaja con el listado cacheado en SQLite, que NO incluye el campo `content`
 * (la API lo excluye del endpoint de listado por tamaño). Este servicio gestiona la
 * hidratación del content siguiendo la skill backend-design:
 *
 *   Escenario A — sin content en caché:
 *     1. Fetch desde GET /templates/{id}
 *     2. Devuelve al frontend inmediatamente
 *     3. Persiste en SQLite en paralelo (no bloqueante)
 *
 *   Escenario B — content ya en caché:
 *     1. Devuelve desde SQLite directamente sin tocar la red
 *
 * El consumidor (TemplateGallery) recibe siempre el mismo shape de objeto
 * sin necesidad de conocer la estrategia interna.
 */

import { apiGet } from './api.js';
import { createLogger } from './logService.js';

const logger = createLogger('template-preview-service');

/**
 * Intenta parsear un JSON string; devuelve null si falla.
 * @param {string|null} str
 * @returns {object|null}
 */
function tryParseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

/**
 * Persiste el detalle de una plantilla en SQLite para cachear el content.
 * Es fire-and-forget: se llama con `void` y los errores no son fatales.
 *
 * @param {number} id
 * @param {object} templateData - Objeto de la API con content, requirements, etc.
 */
async function persistTemplateDetail(id, templateData) {
    try {
        await window.electronAPI.db.upsertMany('templates', [{
            id,
            title:                templateData.title ?? null,
            template_category_id: templateData.template_category_id ?? null,
            data_json:            JSON.stringify(templateData),
            synced_at:            new Date().toISOString(),
        }]);
        logger.info('template detail cached', { id });
    } catch (err) {
        logger.warn('failed to cache template detail', { id, err: err?.message });
    }
}

/**
 * Obtiene el template completo (con content) para mostrar en la vista previa.
 * Usa la caché de SQLite como fuente primaria; solo consulta la API si el content
 * no está disponible localmente.
 *
 * @param {object} partialTemplate - Objeto de la galería (puede no tener content)
 * @returns {Promise<object>} Template hidratado con al menos { id, title, content }
 * @throws {Error} Si la API falla y tampoco hay caché disponible
 */
export async function getTemplateForPreview(partialTemplate) {
    const id = partialTemplate.id;

    // ── Escenario B: intentar servir desde caché ──────────────────────────────
    const cached = await window.electronAPI.db.getById('templates', id);
    const cachedData = tryParseJson(cached?.data_json);

    if (typeof cachedData?.content === 'string' && cachedData.content.trim().length > 0) {
        logger.info('template content served from cache', { id });
        return { ...partialTemplate, ...cachedData };
    }

    // ── Escenario A: content no está en caché → fetch API ────────────────────
    logger.info('template content not cached, fetching from API', { id });

    const result = await apiGet(`/templates/${id}`, { dedupe: false });

    if (!result.ok) {
        throw new Error(`No se pudo cargar la plantilla (HTTP ${result.status})`);
    }

    // La API devuelve { data: { id, title, content, requirements, ... } }
    const templateData = result.data?.data ?? result.data;

    // Persistir en segundo plano sin bloquear la respuesta al frontend
    void persistTemplateDetail(id, templateData);

    return { ...partialTemplate, ...templateData };
}
