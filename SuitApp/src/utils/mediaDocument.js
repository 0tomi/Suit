const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'ogv', 'ogg']);

const MIME_BY_EXTENSION = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    ogv: 'video/ogg',
    ogg: 'video/ogg',
};

function normalizeMimeType(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .split(';')[0];
}

function normalizeExtension(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^\./, '');
}

function extractExtensionFromName(value) {
    const sanitized = String(value || '').split(/[?#]/)[0];
    const match = /\.([a-z0-9]+)$/i.exec(sanitized);
    return normalizeExtension(match?.[1]);
}

function getMimeCandidates(document, blob = null) {
    return [
        document?.mime_type,
        document?.mimeType,
        document?.content_type,
        document?.contentType,
        document?.type,
        document?.latest_version?.mime_type,
        document?.latest_version?.mimeType,
        blob?.type,
    ];
}

function getNameCandidates(document) {
    return [
        document?.name,
        document?.title,
        document?.file_name,
        document?.filename,
        document?.path,
        document?.url,
        document?.download_url,
        document?.latest_version?.name,
        document?.latest_version?.file_name,
        document?.latest_version?.filename,
    ];
}

function inferMimeTypeFromExtension(extension) {
    return MIME_BY_EXTENSION[normalizeExtension(extension)] || '';
}

function hasGenericBlobMimeType(blob) {
    const mimeType = normalizeMimeType(blob?.type);
    return !mimeType || mimeType === 'application/octet-stream';
}

export function getDocumentExtension(document, blob = null) {
    const explicitExtension = normalizeExtension(document?.extension);
    if (explicitExtension) {
        return explicitExtension;
    }

    for (const candidate of getNameCandidates(document)) {
        const inferredExtension = extractExtensionFromName(candidate);
        if (inferredExtension) {
            return inferredExtension;
        }
    }

    const mimeType = getDocumentMimeType(document, blob, { allowOctetStream: false });
    const matchingEntry = Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mimeType);
    return matchingEntry?.[0] || '';
}

export function getDocumentMimeType(document, blob = null, { allowOctetStream = true } = {}) {
    let octetStreamMimeType = '';

    for (const candidate of getMimeCandidates(document, blob)) {
        const normalizedMimeType = normalizeMimeType(candidate);
        if (!normalizedMimeType) {
            continue;
        }

        if (normalizedMimeType === 'application/octet-stream') {
            if (allowOctetStream && !octetStreamMimeType) {
                octetStreamMimeType = normalizedMimeType;
            }
            continue;
        }

        return normalizedMimeType;
    }

    return inferMimeTypeFromExtension(getDocumentExtension(document)) || octetStreamMimeType;
}

export function isVideoDocument(document, blob = null) {
    const mimeType = getDocumentMimeType(document, blob);
    if (mimeType.startsWith('video/')) {
        return true;
    }

    return VIDEO_EXTENSIONS.has(getDocumentExtension(document, blob));
}

export function getMediaDocumentKind(document, blob = null) {
    return isVideoDocument(document, blob) ? 'video' : 'image';
}

export function getMediaLabel(document, blob = null) {
    const extension = getDocumentExtension(document, blob);
    if (extension) {
        return extension.toUpperCase();
    }

    return getMediaDocumentKind(document, blob) === 'video' ? 'VIDEO' : 'IMG';
}

export function buildMediaSource(document, url, blob = null) {
    const isBlobSource = typeof Blob !== 'undefined' && blob instanceof Blob;
    if (isBlobSource && isVideoDocument(document, blob)) {
        return blob;
    }

    if (!url) {
        return null;
    }

    const mimeType = getDocumentMimeType(document, blob);
    return mimeType ? { src: url, type: mimeType } : { src: url };
}

/**
 * Rehidrata blobs multimedia con un MIME reproducible cuando la API responde
 * `application/octet-stream`. Esto evita que el browser no pueda extraer
 * metadata o primer frame de videos descargados.
 */
export function normalizeMediaBlob(document, blob) {
    if (!blob || typeof Blob === 'undefined' || !(blob instanceof Blob)) {
        return blob;
    }

    if (!hasGenericBlobMimeType(blob)) {
        return blob;
    }

    const inferredMimeType = getDocumentMimeType(document, blob, { allowOctetStream: false });
    if (!inferredMimeType || inferredMimeType === 'application/octet-stream') {
        return blob;
    }

    return new Blob([blob], { type: inferredMimeType });
}

export { VIDEO_EXTENSIONS };
