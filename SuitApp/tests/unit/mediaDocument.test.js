import { describe, expect, it } from 'vitest';
import {
    buildMediaSource,
    getDocumentExtension,
    getDocumentMimeType,
    getMediaLabel,
    isVideoDocument,
    normalizeMediaBlob,
} from '../../src/utils/mediaDocument.js';

describe('mediaDocument', () => {
    it('detecta videos a partir del nombre cuando faltan mime_type y extension', () => {
        const document = {
            id: 7,
            name: 'audiencia-final.MP4',
            category: 'multimedia',
        };

        expect(isVideoDocument(document)).toBe(true);
        expect(getDocumentExtension(document)).toBe('mp4');
        expect(getDocumentMimeType(document)).toBe('video/mp4');
        expect(getMediaLabel(document)).toBe('MP4');
    });

    it('prioriza el mime del blob cuando la API devuelve un archivo genérico', () => {
        const document = {
            id: 8,
            name: 'evidencia',
            mime_type: 'application/octet-stream',
        };
        const blob = { type: 'video/webm' };

        expect(isVideoDocument(document, blob)).toBe(true);
        expect(getDocumentMimeType(document, blob)).toBe('video/webm');
        expect(buildMediaSource(document, 'blob:video-preview', blob)).toEqual({
            src: 'blob:video-preview',
            type: 'video/webm',
        });
    });

    it('mantiene imágenes como imagen cuando no hay señales de video', () => {
        const document = {
            id: 9,
            name: 'pericia-foto',
            mime_type: 'image/jpeg',
        };

        expect(isVideoDocument(document)).toBe(false);
        expect(getDocumentMimeType(document)).toBe('image/jpeg');
        expect(getMediaLabel(document)).toBe('JPG');
        expect(buildMediaSource(document, 'blob:image-preview')).toEqual({
            src: 'blob:image-preview',
            type: 'image/jpeg',
        });
    });

    it('rehidrata blobs genéricos con un mime reproducible inferido del documento', () => {
        const document = {
            id: 10,
            name: 'audiencia.mp4',
            mime_type: 'application/octet-stream',
        };
        const blob = new Blob([Uint8Array.from([1, 2, 3])], {
            type: 'application/octet-stream',
        });

        const normalizedBlob = normalizeMediaBlob(document, blob);

        expect(normalizedBlob).not.toBe(blob);
        expect(normalizedBlob.size).toBe(blob.size);
        expect(normalizedBlob.type).toBe('video/mp4');
    });

    it('usa el blob real para videos descargados cuando la vista previa ya tiene object url', () => {
        const document = {
            id: 11,
            name: 'audiencia.mov',
            mime_type: 'video/quicktime',
        };
        const blob = new Blob([Uint8Array.from([1, 2, 3])], {
            type: 'video/quicktime',
        });

        const source = buildMediaSource(document, 'blob:video-preview', blob);

        expect(source).toBe(blob);
    });
});
