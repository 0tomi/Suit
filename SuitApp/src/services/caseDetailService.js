import { getCase, getParticipants, getCaseClients, getCaseAgenda } from './caseService.js';
import { getCaseTypes } from './adminService.js';
import { getHonorariosByCaso } from './honorarioService.js';
import { getGastosByCaso } from './gastoSuitCaseService.js';
import { getDocuments } from './documentService.js';
import { getPartesByCaso } from './parteService.js';
import { getRadicaciones } from './radicacionService.js';
import { resolverDependencia } from './dependenciaJudicialService.js';
import { getCaseTipoExpedientes } from './tipoExpedienteService.js';
import { apiGet } from './api.js';

/**
 * Obtiene los contadores de eventos del caso únicamente desde SQLite.
 *
 * El detalle del caso ya se encarga de mantener la caché fresca vía
 * `GET /cases/{id}/last-modified` + `syncDown`. Repetir acá un
 * `GET /cases/{id}/agenda` generaba un refetch redundante cada vez que
 * se abría el overview aunque la caché ya estuviera al día.
 *
 * @returns {{ deadlinesCount: number, eventsCount: number, fromCache: boolean } | null}
 */
export async function loadCaseEventCount(caseId) {
    if (!caseId) return null;
    const kpis = await getCaseKpisFromDb(caseId);
    if (kpis) {
        return { ...kpis, fromCache: true };
    }

    return null;
}

/**
 * Lee los contadores de eventos y documentos del caso directamente desde SQLite.
 *
 * Query utilizada internamente para el conteo offline de eventos:
 *
 *   SELECT
 *     COALESCE(SUM(CASE WHEN event_types.name = 'Vencimiento' THEN 1 ELSE 0 END), 0) AS deadlinesCount,
 *     COALESCE(SUM(CASE WHEN event_types.name = 'Vencimiento' THEN 0 ELSE 1 END), 0) AS eventsCount
 *   FROM events
 *   LEFT JOIN event_types ON event_types.id = events.event_type_id
 *   WHERE events.suit_case_id = ?
 *
 * La consulta reúne todos los eventos cuyo suit_case_id coincide con el caso
 * y los clasifica en dos buckets según el nombre del tipo de evento.
 *
 * @param {number|string} caseId
 * @returns {{ deadlinesCount: number, eventsCount: number, documentsCount: number } | null}
 */
async function getCaseKpisFromDb(caseId) {
    if (!caseId || !window.electronAPI?.db?.getCaseKpis) return null;
    const metrics = await window.electronAPI.db.getCaseKpis(caseId);
    if (!metrics) return null;
    return {
        deadlinesCount: Number(metrics.deadlinesCount ?? 0),
        eventsCount: Number(metrics.eventsCount ?? 0),
        documentsCount: Number(metrics.documentsCount ?? 0),
    };
}

/**
 * Carga los KPIs completos del caso desde SQLite.
 * El detalle del caso refresca la caché por separado y este helper sólo consume
 * el estado local para no disparar requests redundantes.
 *
 * @returns {{ deadlinesCount: number, eventsCount: number, documentsCount: number }}
 */
export async function getCaseOverviewMetrics(caseId) {
    if (!caseId) {
        return { deadlinesCount: 0, eventsCount: 0, documentsCount: 0 };
    }

    const eventCount = await loadCaseEventCount(caseId);
    const dbKpis = await getCaseKpisFromDb(caseId);

    return {
        deadlinesCount: Number(eventCount?.deadlinesCount ?? dbKpis?.deadlinesCount ?? 0),
        eventsCount: Number(eventCount?.eventsCount ?? dbKpis?.eventsCount ?? 0),
        documentsCount: Number(dbKpis?.documentsCount ?? 0),
    };
}

// Resuelve el fuero visible del caso usando primero el payload del caso y luego el catálogo.
function resolveCaseTypeLabel(caseData, caseTypes) {
    if (typeof caseData?.case_type === 'string' && caseData.case_type.trim()) {
        return caseData.case_type.trim();
    }

    if (typeof caseData?.type === 'string' && caseData.type.trim()) {
        return caseData.type.trim();
    }

    if (caseData?.case_type?.name) {
        return caseData.case_type.name;
    }

    const caseTypeId = caseData?.case_type_id;
    const matchedCaseType = caseTypes.find((item) => String(item.id) === String(caseTypeId ?? ''));
    if (matchedCaseType?.name) {
        return matchedCaseType.name;
    }

    if (caseTypeId != null) {
        return `Fuero #${caseTypeId} no resuelto`;
    }

    return 'Sin fuero';
}

// Toma la radicación desde el payload embebido o desde el catálogo sincronizado.
function resolveRadicacionLabel(caseData, radicaciones) {
    if (caseData?.radicacion?.tipo) {
        return caseData.radicacion.tipo;
    }

    if (caseData?.radicacion?.name) {
        return caseData.radicacion.name;
    }

    if (caseData?.radicacion?.nombre_lugar) {
        return caseData.radicacion.nombre_lugar;
    }

    if (typeof caseData?.radicacion_name === 'string' && caseData.radicacion_name.trim()) {
        return caseData.radicacion_name.trim();
    }

    const radicacionId = caseData?.radicacion_id;
    const matchedRadicacion = radicaciones.find((item) => String(item.id) === String(radicacionId ?? ''));
    if (matchedRadicacion) {
        return matchedRadicacion.tipo || matchedRadicacion.name || matchedRadicacion.nombre_lugar || `Radicación #${matchedRadicacion.id}`;
    }

    if (radicacionId != null) {
        return `Radicación #${radicacionId} no resuelta`;
    }

    return 'Sin radicación';
}

// Normaliza distintas formas de tipo de expediente para poder listarlas en el reporte.
function resolveTipoExpedienteLabel(tipo) {
    if (typeof tipo === 'string' && tipo.trim()) {
        return tipo.trim();
    }

    if (typeof tipo === 'number') {
        return `#${tipo}`;
    }

    if (!tipo || typeof tipo !== 'object') {
        return null;
    }

    if (typeof tipo.title === 'string' && tipo.title.trim()) {
        return tipo.title.trim();
    }

    if (typeof tipo.titulo === 'string' && tipo.titulo.trim()) {
        return tipo.titulo.trim();
    }

    if (typeof tipo.name === 'string' && tipo.name.trim()) {
        return tipo.name.trim();
    }

    if (tipo.id != null) {
        return `#${tipo.id}`;
    }

    return null;
}

// Mezcla la relación remota y cualquier payload embebido, deduplicando por etiqueta visible.
function resolveTipoExpedienteLabels(caseData, linkedTipoExpedientes) {
    const rawCollections = [
        linkedTipoExpedientes,
        caseData?.tipo_expedientes,
        caseData?.tipoExpedientes,
        caseData?.linkedTipoExpedientes,
    ].filter(Array.isArray);

    const labels = rawCollections
        .flatMap((collection) => collection.map((item) => resolveTipoExpedienteLabel(item)))
        .filter(Boolean);

    return Array.from(new Set(labels));
}

// Prioriza la dependencia enriquecida porque trae el nombre real del juzgado.
function resolveDependenciaLabel(caseData, dependencia) {
    if (caseData?.dependencia?.nombre_juzgado) {
        return caseData.dependencia.nombre_juzgado;
    }

    if (caseData?.dependencia?.nombre) {
        return caseData.dependencia.nombre;
    }

    if (dependencia?.nombre_juzgado) {
        return dependencia.nombre_juzgado;
    }

    if (dependencia?.nombre) {
        return dependencia.nombre;
    }

    if (caseData?.dependencia_id != null) {
        return `Dependencia #${caseData.dependencia_id} no resuelta`;
    }

    return 'Sin juzgado';
}

// La jurisdicción del reporte sale de la dependencia resuelta; si falta, lo mostramos explícitamente.
function resolveJurisdiccionLabel(caseData, dependencia) {
    if (caseData?.dependencia?.jurisdiccion?.nombre) {
        return caseData.dependencia.jurisdiccion.nombre;
    }

    if (dependencia?.jurisdiccion?.nombre) {
        return dependencia.jurisdiccion.nombre;
    }

    // Soporte para resultados planos de la cache (JOIN de SQL)
    if (dependencia?.jurisdiccion_nombre) {
        return dependencia.jurisdiccion_nombre;
    }

    if (caseData?.dependencia_id != null) {
        return `Jurisdicción de dependencia #${caseData.dependencia_id} no resuelta`;
    }

    return 'Sin jurisdicción';
}

function normalizeCollection(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    return [];
}

/**
 * REPORTE DE CASO: Consolida toda la información para la Ficha Ejecutiva.
 */
export async function getCaseReportData(caseId) {
    if (!caseId) return null;

    const [
        caseData,
        participants,
        clients,
        agenda,
        honorarios,
        gastos,
        documentsResponse,
        multimediaResponse,
        filesResponse,
        partes,
    ] = await Promise.all([
        getCase(caseId),
        getParticipants(caseId),
        getCaseClients(caseId),
        getCaseAgenda(caseId),
        getHonorariosByCaso(caseId),
        getGastosByCaso(caseId),
        getDocuments(1),
        apiGet('/multimedia'),
        apiGet('/files'),
        getPartesByCaso(caseId),
    ]);

    const normalizedCaseData = caseData?.data || caseData;

    const [caseTypes, linkedTipoExpedientes, radicaciones, dependencia] = await Promise.all([
        getCaseTypes(),
        getCaseTipoExpedientes(caseId),
        getRadicaciones(),
        normalizedCaseData?.dependencia_id ? resolverDependencia(normalizedCaseData.dependencia_id) : Promise.resolve(null),
    ]);

    const normalizedCaseTypes = normalizeCollection(caseTypes);
    const normalizedTipoExpedientes = normalizeCollection(linkedTipoExpedientes);
    const normalizedRadicaciones = normalizeCollection(radicaciones);

    // Normalizar colecciones
    const normalizedParticipants = Array.isArray(participants) ? participants : (Array.isArray(participants?.data) ? participants.data : []);
    const normalizedClients = Array.isArray(clients) ? clients : (Array.isArray(clients?.data) ? clients.data : []);
    const normalizedEvents = Array.isArray(agenda?.events) ? agenda.events : (Array.isArray(agenda?.events?.data) ? agenda.events.data : (Array.isArray(agenda) ? agenda : []));
    const normalizedHonorarios = Array.isArray(honorarios) ? honorarios : (Array.isArray(honorarios?.data) ? honorarios.data : []);
    const normalizedGastos = Array.isArray(gastos) ? gastos : (Array.isArray(gastos?.data) ? gastos.data : []);

    // Filtrar documentos del caso
    const allDocs = Array.isArray(documentsResponse?.data) ? documentsResponse.data : (Array.isArray(documentsResponse) ? documentsResponse : []);
    const caseDocuments = allDocs.filter(doc => Number(doc.suit_case_id) === Number(caseId));

    // Filtrar multimedia y files del caso
    const allMedia = Array.isArray(multimediaResponse?.data) ? multimediaResponse.data : (Array.isArray(multimediaResponse) ? multimediaResponse : []);
    const allFiles = Array.isArray(filesResponse?.data) ? filesResponse.data : (Array.isArray(filesResponse) ? filesResponse : []);
    const caseMedia = allMedia.filter(m => Number(m.suit_case_id) === Number(caseId));
    const caseFiles = allFiles.filter(f => Number(f.suit_case_id) === Number(caseId));

    // Enriquecer honorarios con sus entregas (pagos) individuales
    const honorariosWithEntregas = await Promise.all(
        normalizedHonorarios.map(async (h) => {
            const res = await apiGet(`/honorarios/${h.id}/entregas`);
            return {
                ...h,
                entregas: res.ok ? (res.data?.data || res.data || []) : []
            };
        })
    );

    return {
        caseData: normalizedCaseData,
        caseMetadata: {
            fuero: resolveCaseTypeLabel(normalizedCaseData, normalizedCaseTypes),
            tipoExpedientes: resolveTipoExpedienteLabels(normalizedCaseData, normalizedTipoExpedientes),
            radicacion: resolveRadicacionLabel(normalizedCaseData, normalizedRadicaciones),
            jurisdiccion: resolveJurisdiccionLabel(normalizedCaseData, dependencia),
            dependencia: resolveDependenciaLabel(normalizedCaseData, dependencia),
        },
        participants: normalizedParticipants,
        clients: normalizedClients,
        events: normalizedEvents,
        honorarios: honorariosWithEntregas,
        gastos: normalizedGastos,
        documents: caseDocuments,
        multimedia: caseMedia,
        files: caseFiles,
        partes,
        generatedAt: new Date().toISOString(),
    };
}
