import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocumentContent, getDocumentLastModified } from '../services/documentService.js';
import { createLogger } from '../services/logService.js';
import { normalizeDocumentPayload } from '../utils/documentUtils.js';

const NEW_DOCUMENT_CONTENT = '';
const logger = createLogger('use-document-loader');

const parseJSONSafely = (value) => {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch (err) {
        void logger.error('Error parseando JSON de documento', err);
        return null;
    }
};

const hasTextContent = (value) => typeof value === 'string' && value.trim().length > 0;

const toSQLiteBool = (value) => (value === true || value === 1 || value === '1' ? 1 : 0);

const buildDocumentCacheRow = ({ documentId, previousRow, apiMeta, content }) => {
    const previousMeta = parseJSONSafely(previousRow?.data_json) || {};
    const normalizedApiMeta = normalizeDocumentPayload(apiMeta) || {};
    const mergedMeta = { ...previousMeta, ...normalizedApiMeta, id: Number(documentId) };

    const latestVersion = mergedMeta.latest_version || {};
    const latestCreator = latestVersion.creator || {};
    const latestVersionNumber =
        latestVersion.version_number ??
        mergedMeta.latest_version_number ??
        previousRow?.latest_version_number ??
        null;

    if (latestVersionNumber !== null && latestVersionNumber !== undefined) {
        mergedMeta.latest_version_number = latestVersionNumber;
    }

    return {
        id: Number(documentId),
        name: mergedMeta.name ?? previousRow?.name ?? null,
        suit_case_id: mergedMeta.suit_case_id ?? previousRow?.suit_case_id ?? null,
        user_id: mergedMeta.user_id ?? previousRow?.user_id ?? null,
        content: content !== undefined ? content : (previousRow?.content ?? null),
        is_locked: toSQLiteBool(mergedMeta.is_locked ?? previousRow?.is_locked ?? 0),
        locked_by: mergedMeta.locked_by ?? previousRow?.locked_by ?? null,
        locker_name: mergedMeta.locker?.name ?? mergedMeta.locker_name ?? previousRow?.locker_name ?? null,
        created_at: mergedMeta.created_at ?? previousRow?.created_at ?? null,
        updated_at: mergedMeta.updated_at ?? previousRow?.updated_at ?? null,
        latest_version_number: latestVersionNumber,
        latest_version_created_by:
            latestVersion.created_by ??
            mergedMeta.latest_version_created_by ??
            previousRow?.latest_version_created_by ??
            null,
        latest_version_creator_name:
            latestCreator.name ??
            mergedMeta.latest_version_creator_name ??
            previousRow?.latest_version_creator_name ??
            null,
        latest_version_creator_tag:
            latestCreator.tag ??
            mergedMeta.latest_version_creator_tag ??
            previousRow?.latest_version_creator_tag ??
            null,
        data_json: JSON.stringify(mergedMeta),
        synced_at: new Date().toISOString(),
    };
};

export function useDocumentLoader({
    id,
    db,
    documents,
    initialTitle = '',
    initialContent = NEW_DOCUMENT_CONTENT,
}) {
    const [title, setTitle] = useState(() => (id ? '' : initialTitle));
    const [content, setContent] = useState(() => {
        if (id) return '';
        return typeof initialContent === 'string' ? initialContent : NEW_DOCUMENT_CONTENT;
    });
    const [isLoading, setIsLoading] = useState(Boolean(id));
    const [saveMessage, setSaveMessage] = useState(null);
    const [docMeta, setDocMeta] = useState(null);

    const requestGenerationRef = useRef(0);
    const documentsRef = useRef(documents);
    const docMetaRef = useRef(docMeta);

    useEffect(() => {
        documentsRef.current = documents;
        docMetaRef.current = docMeta;
    }, [documents, docMeta]);

    const upsertDocumentCache = useCallback(async (documentId, htmlContent, apiMeta = null) => {
        const previousRow = await db.getById('documents', Number(documentId));
        const row = buildDocumentCacheRow({
            documentId,
            previousRow,
            apiMeta: apiMeta || docMetaRef.current,
            content: htmlContent,
        });
        await db.upsertMany('documents', [row]);
        return row;
    }, [db]);

    const resolveDocument = useCallback(async (generation) => {
        if (!id) return null;

        const numericId = Number(id);
        let localRow = null;
        let localMeta = null;
        let hadLocalContent = false;

        try {
            localRow = await db.getById('documents', numericId);
        } catch (err) {
            void logger.warn('No se pudo leer caché local del documento', err);
        }

        if (requestGenerationRef.current !== generation) return null;

        if (localRow) {
            localMeta = parseJSONSafely(localRow.data_json) || null;
            const mergedLocalMeta = localMeta || documentsRef.current.find((document) => document.id === numericId) || null;

            if (mergedLocalMeta) {
                setDocMeta(mergedLocalMeta);
            }

            setTitle(localRow.name || mergedLocalMeta?.name || '');

            if (hasTextContent(localRow.content)) {
                hadLocalContent = true;
                setContent(localRow.content);
                setIsLoading(false);

                if (mergedLocalMeta?.pending_local_save === true) {
                    setSaveMessage({
                        type: 'error',
                        text: mergedLocalMeta.pending_local_save_error || 'Hay cambios locales que no se pudieron guardar en el servidor.',
                    });
                }
            }
        }

        let remoteLastModified = null;
        try {
            remoteLastModified = await getDocumentLastModified(id);
        } catch (err) {
            void logger.warn('No se pudo consultar last-modified del documento', err);
        }

        if (requestGenerationRef.current !== generation) return null;

        const localUpdatedAt = localRow?.updated_at || localMeta?.updated_at || null;
        const remoteUpdatedAt = remoteLastModified?.last_modified || null;
        const hasRemoteNewerVersion =
            !!remoteUpdatedAt &&
            (!localUpdatedAt || new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime());
        const shouldFetchContent = !hadLocalContent || hasRemoteNewerVersion;

        if (shouldFetchContent) {
            let freshContent = null;
            try {
                freshContent = await getDocumentContent(id);
            } catch (err) {
                void logger.warn('No se pudo obtener contenido del documento', err);
            }

            if (requestGenerationRef.current !== generation) return null;

            if (typeof freshContent === 'string') {
                setContent(freshContent);

                try {
                    const persistedRow = await upsertDocumentCache(numericId, freshContent, {
                        ...(localMeta || {}),
                        updated_at: remoteUpdatedAt || localMeta?.updated_at || null,
                        pending_local_save: false,
                        pending_local_save_error: null,
                        pending_local_save_at: null,
                    });
                    const persistedMeta = parseJSONSafely(persistedRow?.data_json) || null;
                    if (persistedMeta) {
                        setDocMeta(persistedMeta);
                        setTitle(persistedRow?.name || persistedMeta?.name || '');
                    }
                } catch (err) {
                    void logger.warn('No se pudo persistir contenido del documento en SQLite', err);
                }
            }

            if (hadLocalContent && hasRemoteNewerVersion && hasTextContent(freshContent)) {
                setSaveMessage({
                    type: 'success',
                    text: 'Se actualizó el documento a la última versión del servidor.',
                });
            }
        } else if (remoteUpdatedAt) {
            try {
                const persistedRow = await upsertDocumentCache(numericId, localRow?.content ?? null, {
                    ...(localMeta || {}),
                    updated_at: remoteUpdatedAt,
                });
                const persistedMeta = parseJSONSafely(persistedRow?.data_json) || null;
                if (persistedMeta) {
                    setDocMeta(persistedMeta);
                    setTitle(persistedRow?.name || persistedMeta?.name || '');
                }
            } catch (err) {
                void logger.warn('No se pudo actualizar metadata local del documento', err);
            }
        }

        if (requestGenerationRef.current === generation) {
            setIsLoading(false);
        }

        return null;
    }, [db, id, upsertDocumentCache]);

    useEffect(() => {
        if (!id) return;

        const generation = ++requestGenerationRef.current;
        void resolveDocument(generation);

        return () => {
            requestGenerationRef.current += 1;
        };
    }, [id, resolveDocument]);

    useEffect(() => {
        if (!saveMessage) return undefined;

        const timer = setTimeout(() => setSaveMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [saveMessage]);

    const refreshDocument = useCallback(async () => {
        if (!id) return null;

        const generation = ++requestGenerationRef.current;
        setIsLoading(true);

        return await resolveDocument(generation);
    }, [id, resolveDocument]);

    return {
        title,
        setTitle,
        content,
        setContent,
        docMeta,
        setDocMeta,
        isLoading,
        saveMessage,
        setSaveMessage,
        refreshDocument,
        upsertDocumentCache,
    };
}
