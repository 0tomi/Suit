/**
 * documentService.js — CRUD de documentos contra la API SuitAPI.
 */
import { apiGet, apiRequest } from './api.js';
import { createLogger } from './logService.js';

const logger = createLogger('document-service');

/**
 * Lista documentos paginados.
 */
export async function getDocuments(page = 1) {
    const result = await apiGet('/documents', { params: { page } });
    if (!result.ok) {
        void logger.warn('getDocuments request failed', {
            page,
            status: result.status,
            error: result.error || null,
            message: result.data?.message || null,
        });
    }
    return result.ok ? result.data : { data: [] };
}

/**
 * Obtiene un documento individual (descifrado).
 */
export async function getDocument(id) {
    const result = await apiGet(`/documents/${id}`, { responseType: 'text' });
    if (!result.ok) {
        void logger.warn('getDocument request failed', {
            documentId: id,
            status: result.status,
            error: result.error || null,
            message: result.data?.message || null,
        });
        return null;
    }

    if (typeof result.data !== 'string') {
        void logger.warn('getDocument returned non-text payload', {
            documentId: id,
            status: result.status,
            payloadType: typeof result.data,
        });
        return null;
    }

    return result.data;
}

/**
 * Crea un documento nuevo.
 */
export async function createDocument(docData) {
    const { content = '', status = 'Borrador', ...meta } = docData || {};
    const normalizedName = typeof (meta.name || meta.title) === 'string'
        ? (meta.name || meta.title).trim()
        : '';

    if (!normalizedName) {
        void logger.error('createDocument aborted: missing document name', {
            providedFields: Object.keys(docData || {}),
        });
        return {
            ok: false,
            status: 422,
            data: null,
            error: 'El documento necesita un título.',
        };
    }

    if (typeof content !== 'string') {
        void logger.error('createDocument aborted: invalid content type', {
            contentType: typeof content,
        });
        return {
            ok: false,
            status: 422,
            data: null,
            error: 'El contenido del documento debe ser HTML en formato string.',
        };
    }

    const payload = {
        name: normalizedName,
        content,
        status,
    };

    if (meta.suit_case_id !== null && meta.suit_case_id !== undefined) {
        payload.suit_case_id = meta.suit_case_id;
    }

    if (meta.event_id !== null && meta.event_id !== undefined) {
        payload.event_id = meta.event_id;
    }

    const result = await apiRequest('/documents', { method: 'POST', body: payload });
    if (!result.ok) {
        void logger.error('createDocument request failed', {
            status: result.status,
            error: result.error || null,
            message: result.data?.message || null,
            payloadKeys: Object.keys(payload),
            payloadPreview: payload,
        });
    }

    return result;
}

/**
 * Actualiza el contenido de un documento (requiere lock previo).
 * El endpoint crea siempre una nueva versión.
 */
export async function updateDocument(id, docData) {
    const { content } = docData || {};
    const payload = Object.fromEntries(Object.entries({
        ...(content !== undefined ? { content } : {}),
    }).filter(([, value]) => value !== undefined && value !== null));

    const result = await apiRequest(`/documents/${id}`, { method: 'PUT', body: payload });
    if (!result.ok) {
        void logger.error('updateDocument request failed', {
            documentId: id,
            status: result.status,
            error: result.error || null,
            message: result.data?.message || null,
            payloadKeys: Object.keys(payload),
            payloadPreview: payload,
        });
    }

    return result;
}

/**
 * Actualiza el nombre de un documento sin crear versión nueva.
 */
export async function updateDocumentName(id, name) {
    const payload = Object.fromEntries(Object.entries({
        ...(name ? { name } : {}),
    }).filter(([, value]) => value !== undefined && value !== null));

    const result = await apiRequest(`/documents/${id}/name`, {
        method: 'PATCH',
        body: payload,
    });

    if (!result.ok) {
        void logger.error('updateDocumentName request failed', {
            documentId: id,
            status: result.status,
            error: result.error || null,
            message: result.data?.message || null,
            payloadKeys: Object.keys(payload),
            payloadPreview: payload,
        });
    }

    return result;
}

/**
 * Elimina un documento y sus versiones.
 */
export async function deleteDocument(id) {
    return await apiRequest(`/documents/${id}`, { method: 'DELETE' });
}

/**
 * Bloquea un documento para edición exclusiva.
 */
export async function lockDocument(id) {
    return await apiRequest(`/documents/${id}/lock`, { method: 'POST' });
}

/**
 * Desbloquea un documento.
 */
export async function unlockDocument(id) {
    return await apiRequest(`/documents/${id}/unlock`, { method: 'POST' });
}

/**
 * Actualiza el estado de un documento.
 */
export async function updateDocumentStatus(id, status) {
    const result = await apiRequest(`/documents/${id}/status`, {
        method: 'PATCH',
        body: { status },
    });
    return result;
}

/**
 * Consulta si el documento está bloqueado para el usuario actual.
 */
export async function getDocumentLockStatus(id) {
    const result = await apiGet(`/documents/${id}/is-locked`);
    return {
        ok: result.ok,
        is_locked: result.ok ? !!result.data?.is_locked : true,
        status: result.status,
        data: result.data,
        error: result.error || null,
    };
}

/**
 * Obtiene el historial de versiones de un documento.
 */
export async function getDocumentVersions(id) {
    const result = await apiGet(`/documents/${id}/versions`);
    if (!result.ok) return [];
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.data?.data)) return result.data.data;
    return [];
}

/**
 * Obtiene fecha de última modificación y autor de la última versión.
 */
export async function getDocumentLastModified(id) {
    const result = await apiGet(`/documents/${id}/last-modified`);
    return result.ok ? result.data : null;
}

/**
 * Vincula clientes a un documento.
 */
export async function linkClientsToDocument(docId, clientIds) {
    return await apiRequest(`/documents/${docId}/clients`, {
        method: 'POST',
        body: { client_ids: clientIds },
    });
}



/**
 * Desvincula un cliente de un documento.
 */
export async function unlinkClientFromDocument(docId, clientId) {
    return await apiRequest(`/documents/${docId}/clients/${clientId}`, { method: 'DELETE' });
}

/**
 * Obtiene el contenido HTML crudo de un documento.
 * La API devuelve text/plain con el HTML, no JSON.
 */
export async function getDocumentContent(id) {
    return await getDocument(id);
}

function parseVersionContentResponse(rawResponse) {
    if (typeof rawResponse !== 'string') return null;

    const trimmed = rawResponse.trim();
    if (!trimmed) return '';

    // Algunas implementaciones devuelven JSON y otras responden HTML plano.
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return rawResponse;
    }

    try {
        const parsed = JSON.parse(trimmed);
        return (
            parsed?.content ??
            parsed?.html ??
            parsed?.data?.content ??
            parsed?.data?.html ??
            null
        );
    } catch {
        return rawResponse;
    }
}

/**
 * Obtiene el HTML de una versión histórica puntual.
 * Soporta respuestas en texto plano o JSON para no acoplarse a una única implementación backend.
 */
export async function getDocumentVersionContent(docId, versionId) {
    const result = await apiGet(`/documents/${docId}/versions/${versionId}`, {
        responseType: 'text',
        dedupe: false,
    });

    if (!result.ok) return null;

    const parsedContent = parseVersionContentResponse(result.data);
    if (typeof parsedContent === 'string') return parsedContent;

    const versions = await getDocumentVersions(docId);
    const selectedVersion = versions.find((version) => String(version.id) === String(versionId));

    return (
        selectedVersion?.content ??
        selectedVersion?.html ??
        selectedVersion?.document_content ??
        null
    );
}

/**
 * Obtiene los clientes asociados a un documento específico.
 */
export async function getDocumentClients(docId) {
    return await apiGet(`/documents/${docId}/clients`);
}

/**
 * Obtiene la fecha de última modificación global de documentos.
 */
export async function getDocumentsLastModified() {
    const result = await apiGet('/documents/last-modified');
    return result.ok ? result.data?.last_modified : null;
}
