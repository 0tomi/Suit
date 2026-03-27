/**
 * jurisdiccionService.js — Acceso a jurisdicciones y competencias (fueros).
 *
 * Estrategia cache-first:
 * - getJurisdicciones() y getCompetencias() leen directo de SQLite.
 *   Son usadas en formularios donde la velocidad de respuesta es crítica.
 *
 * - getCompetenciasByJurisdiccionFresh(id) sincroniza competencias y dependencias antes de leer.
 *   Usar en vistas de administración/catálogos, donde los datos deben estar siempre al día.
 *
 * Relación jurisdicción ↔ competencia:
 *   La tabla `dependencias_judiciales` actúa de pivot. Una jurisdicción tiene ciertas competencias
 *   porque existen dependencias (juzgados) que combinan esa jurisdicción con esa competencia.
 *   getCompetencias(jurisdiccionId) explota este pivot para devolver las competencias relevantes.
 */
import { apiRequest } from './api.js';
import { syncCompetencias, syncDependenciasJudiciales } from './sync/metadataSyncService.js';

// ─── Helper de caché ──────────────────────────────────────────────────────────

async function readCacheTable(table) {
    if (!window.electronAPI) return [];
    const rows = await window.electronAPI.db.getAll(table);
    if (!rows || rows.length === 0) return [];
    return rows.map((row) => {
        try {
            return row.data_json ? JSON.parse(row.data_json) : row;
        } catch {
            return row;
        }
    });
}

// ─── Jurisdicciones ───────────────────────────────────────────────────────────

/**
 * Devuelve todas las jurisdicciones desde la caché local.
 * @returns {Promise<Array>}
 */
export async function getJurisdicciones() {
    return readCacheTable('jurisdicciones');
}

export async function createJurisdiccion(data) {
    return await apiRequest('/jurisdicciones', { method: 'POST', body: data });
}

export async function updateJurisdiccion(id, data) {
    return await apiRequest(`/jurisdicciones/${id}`, { method: 'PUT', body: data });
}

export async function deleteJurisdiccion(id) {
    return await apiRequest(`/jurisdicciones/${id}`, { method: 'DELETE' });
}

// ─── Competencias ─────────────────────────────────────────────────────────────

/**
 * Devuelve todas las competencias desde la caché local, sin verificar la API.
 * @returns {Promise<Array>}
 */
export async function getAllCompetencias() {
    return readCacheTable('competencias');
}

/**
 * Devuelve las competencias asociadas a una jurisdicción usando la tabla pivot
 * `dependencias_judiciales` como fuente de la relación. Lee exclusivamente de caché.
 *
 * Usar en formularios de selección (ej: selector de fuero al crear/editar un caso).
 *
 * @param {number} jurisdiccionId
 * @returns {Promise<Array>} competencias únicas para esa jurisdicción
 */
export async function getCompetencias(jurisdiccionId) {
    const [dependencias, competencias] = await Promise.all([
        readCacheTable('dependencias_judiciales'),
        readCacheTable('competencias'),
    ]);

    // Obtener IDs únicos de competencias que aparecen en dependencias de esta jurisdicción
    const competenciaIds = new Set(
        dependencias
            .filter((dep) => dep.jurisdiccion_id === jurisdiccionId)
            .map((dep) => dep.competencia_id)
    );

    return competencias.filter((c) => competenciaIds.has(c.id));
}

/**
 * Versión "fresh" de getCompetencias: sincroniza competencias y dependencias contra la API
 * antes de leer del caché. Cada sync verifica last-modified, por lo que si no hubo cambios
 * no se hace ninguna descarga adicional.
 *
 * Usar en vistas de administración/catálogos, donde se necesitan datos siempre actualizados.
 *
 * @param {number} jurisdiccionId
 * @returns {Promise<Array>} competencias únicas para esa jurisdicción, garantizadas frescas
 */
export async function getCompetenciasByJurisdiccionFresh(jurisdiccionId) {
    // Sincronizar ambos recursos en paralelo; cada uno verifica last-modified internamente.
    await Promise.all([syncCompetencias(), syncDependenciasJudiciales()]);
    return getCompetencias(jurisdiccionId);
}

export async function createCompetencia(data) {
    return await apiRequest('/competencias', { method: 'POST', body: data });
}

export async function updateCompetencia(id, data) {
    return await apiRequest(`/competencias/${id}`, { method: 'PUT', body: data });
}

export async function deleteCompetencia(id) {
    return await apiRequest(`/competencias/${id}`, { method: 'DELETE' });
}
