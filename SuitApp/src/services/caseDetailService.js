import { getCase, getParticipants, getCaseClients, getCaseAgenda } from './caseService.js';
import { getHonorariosByCaso } from './honorarioService.js';
import { getGastosByCaso } from './gastoSuitCaseService.js';
import { getDocuments } from './documentService.js';
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

/**
 * REPORTE DE CASO: Consolida toda la información para la Ficha Ejecutiva.
 */
export async function getCaseReportData(caseId) {
    if (!caseId) return null;

    try {
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
            partesResponse,
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
            apiGet(`/suit-cases/${caseId}/partes`),
        ]);

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
        const casePartes = Array.isArray(partesResponse?.data) ? partesResponse.data : (Array.isArray(partesResponse) ? partesResponse : []);

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
            caseData: caseData?.data || caseData,
            participants: normalizedParticipants,
            clients: normalizedClients,
            events: normalizedEvents,
            honorarios: honorariosWithEntregas,
            gastos: normalizedGastos,
            documents: caseDocuments,
            multimedia: caseMedia,
            files: caseFiles,
            partes: casePartes,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error al generar data para reporte de caso:', error);
        return null;
    }
}
