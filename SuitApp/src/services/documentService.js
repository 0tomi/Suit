/**
 * documentService.js — CRUD de documentos contra la API SuitAPI.
 */
import { apiGet, apiRequest } from './api.js';

/**
 * Lista documentos paginados.
 */
export async function getDocuments(page = 1) {
    const result = await apiGet('/documents', { params: { page } });
    return result.ok ? result.data : { data: [] };
}

/**
 * Obtiene un documento individual (descifrado).
 */
export async function getDocument(id) {
    const result = await apiGet(`/documents/${id}`);
    return result.ok ? result.data : null;
}

/**
 * Convierte contenido HTML en un FormData listo para enviar a la API.
 * La API espera un campo `file` de tipo multipart (mimes: html, txt).
 */
function htmlToFormData(htmlContent, extraFields = {}) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const formData = new FormData();
    formData.append('file', blob, 'document.html');
    for (const [key, value] of Object.entries(extraFields)) {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    }
    return formData;
}

/**
 * Crea un documento nuevo.
 */
export async function createDocument(docData) {
    const { content = '', ...meta } = docData;
    const formData = htmlToFormData(content, meta);
    return await apiRequest('/documents', { method: 'POST', body: formData });
}

/**
 * Actualiza un documento (requiere lock previo).
 */
export async function updateDocument(id, docData) {
    const { content = '', ...meta } = docData;
    const formData = htmlToFormData(content, meta);
    // Laravel PUT con multipart no funciona bien — usar POST con _method=PUT
    formData.append('_method', 'PUT');
    return await apiRequest(`/documents/${id}`, { method: 'POST', body: formData });
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
    return await apiRequest(`/documents/${id}/lock`, { method: 'DELETE' });
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
    const result = await apiGet(`/documents/${id}`, { responseType: 'text' });
    return result.ok ? result.data : null;
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
    const result = await apiGet(`/documents/${docId}/clients`);
    return result.ok ? (result.data?.data || result.data || []) : [];
}

/**
 * Obtiene la fecha de última modificación global de documentos.
 */
export async function getDocumentsLastModified() {
    const result = await apiGet('/documents/last-modified');
    return result.ok ? result.data?.last_modified : null;
}
