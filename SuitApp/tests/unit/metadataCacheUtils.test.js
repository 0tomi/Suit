import { describe, expect, it } from 'vitest';
import { buildCaseCacheRow } from '../../src/services/cache/caseCacheRow.js';
import { extractMetadataCollection, summarizePayload } from '../../src/services/metadata/metadataCacheUtils.js';

describe('extractMetadataCollection', () => {
    it('acepta arrays directos', () => {
        const rows = [{ id: 1, name: 'Penal' }];
        expect(extractMetadataCollection(rows, 'case_types')).toEqual(rows);
    });

    it('acepta payloads anidados por nombre de recurso', () => {
        const rows = [{ id: 2, name: 'Civil' }];
        expect(extractMetadataCollection({ case_types: rows }, 'case_types')).toEqual(rows);
        expect(extractMetadataCollection({ event_types: rows }, 'event_types')).toEqual(rows);
    });

    it('acepta payloads genericos con data, items o records', () => {
        const rows = [{ id: 3, name: 'Laboral' }];
        expect(extractMetadataCollection({ data: rows }, 'case_types')).toEqual(rows);
        expect(extractMetadataCollection({ items: rows }, 'case_types')).toEqual(rows);
        expect(extractMetadataCollection({ records: rows }, 'case_types')).toEqual(rows);
    });

    it('retorna null con shapes invalidos', () => {
        expect(extractMetadataCollection({ foo: [] }, 'case_types')).toBeNull();
        expect(extractMetadataCollection(null, 'case_types')).toBeNull();
    });
});

describe('summarizePayload', () => {
    it('resume arrays y objetos', () => {
        expect(summarizePayload([{ id: 1 }])).toEqual({ kind: 'array', length: 1 });
        expect(summarizePayload({ data: [], foo: true })).toEqual({ kind: 'object', keys: ['data', 'foo'] });
    });
});

describe('buildCaseCacheRow', () => {
    it('normaliza la fila de cache de un caso', () => {
        const row = buildCaseCacheRow({
            id: 7,
            title: 'Caso Penal',
            case_type: 'Penal',
            case_type_id: 3,
            status: 'active',
            owner_tag: 'user',
            start_date: '2026-03-03',
            end_date: null,
            details: 'Detalle',
            updated_at: '2026-03-03T00:00:00.000Z',
        });

        expect(row).toMatchObject({
            id: 7,
            title: 'Caso Penal',
            case_type: 'Penal',
            case_type_id: 3,
            status: 'active',
            owner_tag: 'user',
            start_date: '2026-03-03',
            end_date: null,
            details: 'Detalle',
            updated_at: '2026-03-03T00:00:00.000Z',
        });
        expect(typeof row.data_json).toBe('string');
        expect(typeof row.synced_at).toBe('string');
    });

    it('retorna null si el caso no tiene id', () => {
        expect(buildCaseCacheRow({ title: 'Sin id' })).toBeNull();
    });
});
