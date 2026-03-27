/**
 * dependenciaJudicialService.js — Acceso a dependencias judiciales (juzgados).
 *
 * Estrategia cache-first:
 * - Todas las lecturas van primero a SQLite. Cero latencia de red.
 * - Las mutaciones (crear, editar, eliminar) van directamente a la API.
 * - El sync en segundo plano (DependenciasJudicialesContext) mantiene la caché fresca.
 */
import { apiRequest } from './api.js';

// ─── Helper interno ───────────────────────────────────────────────────────────

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

// ─── Lecturas desde caché ─────────────────────────────────────────────────────

/**
 * Devuelve todas las dependencias judiciales desde caché.
 * @returns {Promise<Array<{id, jurisdiccion_id, competencia_id, nombre_juzgado, ...}>}
 */
export async function getDependenciasJudiciales() {
    return readCacheTable('dependencias_judiciales');
}

/**
 * Devuelve las dependencias de una jurisdicción, filtradas desde caché.
 * Usar en el selector de juzgado del formulario de caso.
 * @param {number} jurisdiccionId
 * @returns {Promise<Array>}
 */
export async function getDependenciasByJurisdiccion(jurisdiccionId) {
    const all = await getDependenciasJudiciales();
    return all.filter((dep) => dep.jurisdiccion_id === jurisdiccionId);
}

/**
 * Devuelve una dependencia por ID desde caché.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getDependenciaById(id) {
    const all = await getDependenciasJudiciales();
    return all.find((dep) => dep.id === id) ?? null;
}

// ─── Lecturas enriquecidas ────────────────────────────────────────────────────

/**
 * Devuelve dependencias con los nombres de competencia y jurisdicción ya resueltos desde caché.
 * Cada objeto tiene: id, nombre_juzgado, competencia (objeto), jurisdiccion (objeto).
 *
 * Usar cuando el frontend necesite mostrar el nombre del juzgado junto con su fuero
 * y jurisdicción (ej: listado de juzgados en la vista de catálogos).
 *
 * @param {number} [jurisdiccionId] — si se pasa, filtra por jurisdicción
 * @returns {Promise<Array<{id, nombre_juzgado, competencia_id, jurisdiccion_id, competencia, jurisdiccion}>>}
 */
export async function getDependenciasEnriquecidas(jurisdiccionId = null) {
    // Si tenemos la API de Electron, usamos la versión optimizada en SQL del backend.
    if (window.electronAPI?.db?.getEnrichedDependencies) {
        return window.electronAPI.db.getEnrichedDependencies(jurisdiccionId, null);
    }

    // Fallback: implementar enriquecimiento en memoria (como estaba antes).
    const [dependencias, competencias, jurisdicciones] = await Promise.all([
        readCacheTable('dependencias_judiciales'),
        readCacheTable('competencias'),
        readCacheTable('jurisdicciones'),
    ]);

    const competenciaById = new Map(competencias.map((c) => [c.id, c]));
    const jurisdiccionById = new Map(jurisdicciones.map((j) => [j.id, j]));

    const filtered = jurisdiccionId !== null
        ? dependencias.filter((dep) => dep.jurisdiccion_id === jurisdiccionId)
        : dependencias;

    return filtered.map((dep) => ({
        ...dep,
        competencia: competenciaById.get(dep.competencia_id) ?? null,
        jurisdiccion: jurisdiccionById.get(dep.jurisdiccion_id) ?? null,
    }));
}

/**
 * Obtiene dependencias filtradas por jurisdicción y radicación usando SQL en el backend.
 * Devuelve formato enriquecido (con objetos competencia, jurisdiccion y radicacion resueltos).
 *
 * @param {number|null} jurisdiccionId
 * @param {number|null} radicacionId
 * @returns {Promise<Array>}
 */
export async function getDependenciasFiltradas(jurisdiccionId = null, radicacionId = null) {
    if (window.electronAPI?.db?.getEnrichedDependencies) {
        return window.electronAPI.db.getEnrichedDependencies(jurisdiccionId, radicacionId);
    }
    // Fallback si no hay IPC
    const all = await getDependenciasEnriquecidas(jurisdiccionId);
    return radicacionId !== null
        ? all.filter((dep) => dep.radicacion_id === radicacionId)
        : all;
}

/**
 * Devuelve una dependencia por ID con competencia y jurisdicción resueltas desde caché.
 * Usar para mostrar el juzgado completo de un caso ya guardado (ej: detalle de caso).
 *
 * @param {number} id
 * @returns {Promise<{id, nombre_juzgado, competencia, jurisdiccion, ...}|null>}
 *
 * @example
 * const dep = await resolverDependencia(caso.dependencia_id);
 * dep.nombre_juzgado     // "Juzgado Civil N° 3"
 * dep.competencia.fuero  // "Civil y Comercial"
 * dep.jurisdiccion.nombre // "Santa Fe"
 */
export async function resolverDependencia(id) {
    if (!id) return null;
    const enriquecidas = await getDependenciasEnriquecidas();
    return enriquecidas.find((dep) => dep.id === id) ?? null;
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Crea un nuevo juzgado en la API.
 * @param {{ jurisdiccion_id: number, competencia_id: number, radicacion_id: number, nombre_juzgado: string }} data
 */
export async function createDependenciaJudicial(data) {
    return await apiRequest('/dependencias-judiciales', { method: 'POST', body: data });
}

export async function updateDependenciaJudicial(id, data) {
    return await apiRequest(`/dependencias-judiciales/${id}`, { method: 'PUT', body: data });
}

export async function deleteDependenciaJudicial(id) {
    return await apiRequest(`/dependencias-judiciales/${id}`, { method: 'DELETE' });
}
