const DOCUMENT_STATUS_LABELS = {
    active: 'Activo',
    activo: 'Activo',
    inactive: 'Inactivo',
    inactivo: 'Inactivo',
    draft: 'Borrador',
    borrador: 'Borrador',
    signed: 'Firmado',
    firmado: 'Firmado',
    submitted: 'Presentado',
    presented: 'Presentado',
    presentado: 'Presentado',
    published: 'Publicado',
    publicado: 'Publicado',
    archived: 'Archivado',
    archivado: 'Archivado',
    closed: 'Cerrado',
    cerrado: 'Cerrado',
    finalized: 'Finalizado',
    finalizado: 'Finalizado',
};

export const DOCUMENT_STATUS_OPTIONS = [
    'Borrador',
    'Activo',
    'Firmado',
    'Presentado',
    'Publicado',
    'Archivado',
    'Inactivo',
    'Cerrado',
    'Finalizado',
];

/**
 * Traduce el estado crudo del documento a una etiqueta estable para la UI.
 * La API/caché pueden devolver estados en inglés y esta capa evita fugas de esos valores.
 */
export function getDocumentStatusLabel(status) {
    if (status === null || status === undefined || status === '') {
        return 'Borrador';
    }

    const normalizedStatus = String(status).trim();
    const mappedStatus = DOCUMENT_STATUS_LABELS[normalizedStatus.toLowerCase()];

    return mappedStatus || normalizedStatus;
}

/**
 * Devuelve una variante visual consistente para badges de estado de documentos.
 */
export function getDocumentStatusVariant(status) {
    const label = getDocumentStatusLabel(status);

    if (label === 'Activo' || label === 'Presentado' || label === 'Publicado') {
        return 'success';
    }

    if (label === 'Firmado') {
        return 'info';
    }

    if (label === 'Borrador' || label === 'Inactivo') {
        return 'warning';
    }

    if (label === 'Archivado' || label === 'Cerrado' || label === 'Finalizado') {
        return 'default';
    }

    return 'default';
}
