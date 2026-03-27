/**
 * Construye la ruta de alta de documentos soportando modelo y caso precargados.
 * Mantiene compatibilidad con la firma anterior: `buildDocumentCreatePath(templateId)`.
 */
export function buildDocumentCreatePath(options = null) {
    const normalized = typeof options === 'object' && options !== null
        ? options
        : { templateId: options };

    const searchParams = new URLSearchParams();

    if (normalized.templateId !== null && normalized.templateId !== undefined && normalized.templateId !== '') {
        searchParams.set('templateId', String(normalized.templateId));
    }

    if (normalized.caseId !== null && normalized.caseId !== undefined && normalized.caseId !== '') {
        searchParams.set('caseId', String(normalized.caseId));
    }

    const query = searchParams.toString();
    return query ? `/documents/new?${query}` : '/documents/new';
}

export function buildDocumentEditPath(documentId) {
    return `/documents/edit/${documentId}`;
}

export function buildDocumentVersionPath(documentId, versionId, versionNumber = null) {
    const searchParams = new URLSearchParams({
        versionId: String(versionId),
    });

    if (versionNumber !== null && versionNumber !== undefined && versionNumber !== '') {
        searchParams.set('versionNumber', String(versionNumber));
    }

    return `${buildDocumentEditPath(documentId)}?${searchParams.toString()}`;
}

export function buildTemplateCreatePath() {
    return '/templates/new';
}

export function buildTemplateEditPath(templateId) {
    return `/templates/edit/${templateId}`;
}
