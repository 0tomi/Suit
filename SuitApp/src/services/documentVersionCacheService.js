function getDocumentsBridge() {
    return window.electronAPI?.documents ?? null;
}

/**
 * Delegamos el historial al backend de Electron para que el renderer no
 * consulte la API ni decida por su cuenta la frescura del caché.
 */
export async function getDocumentVersionsCached(documentId) {
    const bridge = getDocumentsBridge();
    if (typeof bridge?.getVersionHistory !== 'function') return [];
    return await bridge.getVersionHistory(documentId);
}

/**
 * El contenido puntual de una versión también se resuelve en Electron.
 * Ahí se decide si se sirve desde SQLite o si hace falta traerlo de la API.
 */
export async function getDocumentVersionContentCached(documentId, versionId, fallbackVersion = null) {
    const bridge = getDocumentsBridge();
    if (typeof bridge?.getVersionContent !== 'function') return null;
    return await bridge.getVersionContent(documentId, versionId, fallbackVersion);
}
