import { describe, expect, it } from 'vitest';

import { buildDocumentCreatePath, buildDocumentEditPath } from '../../src/utils/appRoutes.js';

describe('appRoutes', () => {
    it('construye la ruta de documento nuevo sin template por defecto', () => {
        expect(buildDocumentCreatePath()).toBe('/documents/new');
    });

    it('construye la ruta de documento nuevo con templateId', () => {
        expect(buildDocumentCreatePath(14)).toBe('/documents/new?templateId=14');
    });

    it('construye la ruta de documento nuevo con caso precargado', () => {
        expect(buildDocumentCreatePath({ caseId: 21 })).toBe('/documents/new?caseId=21');
    });

    it('construye la ruta de documento nuevo con template y caso', () => {
        expect(buildDocumentCreatePath({ templateId: 14, caseId: 21 })).toBe('/documents/new?templateId=14&caseId=21');
    });

    it('construye la ruta de edición de documento', () => {
        expect(buildDocumentEditPath(9)).toBe('/documents/edit/9');
    });
});
