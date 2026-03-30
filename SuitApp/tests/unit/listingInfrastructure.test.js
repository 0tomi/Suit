import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    buildCacheKey,
    buildListingResponse,
    buildPaginatedResponseFromItems,
    canReuseListingSnapshot,
    extractPaginationMeta,
} = require('../../electron/listingBackendUtils.cjs');
const {
    buildListingCacheEntry,
    hydrateListingCacheRow,
} = require('../../electron/listingCacheRepository.cjs');

describe('listingBackendUtils.cjs', () => {
    it('serializa cache keys de forma estable sin depender del orden de los params', () => {
        const left = buildCacheKey('list', {
            search: 'ana',
            status: 'activo',
        });
        const right = buildCacheKey('list', {
            status: 'activo',
            search: 'ana',
        });

        expect(left).toBe(right);
    });

    it('normaliza el envelope del listado con alias totalDocuments', () => {
        const response = buildListingResponse({
            items: [{ id: 1 }],
            page: 2,
            total: 51,
            totalPages: 3,
            perPage: 20,
            source: 'api',
            appliedLocalFilters: true,
        });

        expect(response).toEqual({
            items: [{ id: 1 }],
            page: 2,
            total: 51,
            totalPages: 3,
            perPage: 20,
            source: 'api',
            appliedLocalFilters: true,
            totalDocuments: 51,
        });
    });

    it('extrae metadata paginada desde respuestas con meta anidada', () => {
        const meta = extractPaginationMeta({
            meta: {
                current_page: 3,
                last_page: 9,
                total: 250,
                per_page: 30,
            },
        });

        expect(meta).toEqual({
            currentPage: 3,
            lastPage: 9,
            total: 250,
            perPage: 30,
        });
    });

    it('pagina correctamente un array reconstruido localmente', () => {
        const response = buildPaginatedResponseFromItems({
            items: Array.from({ length: 45 }, (_, index) => ({ id: index + 1 })),
            page: 2,
            perPage: 20,
            source: 'cache-reconstructed',
        });

        expect(response.page).toBe(2);
        expect(response.total).toBe(45);
        expect(response.totalPages).toBe(3);
        expect(response.items.map((item) => item.id)).toEqual([
            21, 22, 23, 24, 25,
            26, 27, 28, 29, 30,
            31, 32, 33, 34, 35,
            36, 37, 38, 39, 40,
        ]);
    });

    it('reutiliza snapshots cuando last-server coincide con last-modified', () => {
        const snapshot = {
            total_items: 12,
            items: [{ id: 1 }],
        };
        const meta = {
            last_server: '2026-03-28T12:00:00.000000Z',
        };

        expect(
            canReuseListingSnapshot(snapshot, meta, '2026-03-28T12:00:00.000000Z'),
        ).toBe(true);
        expect(
            canReuseListingSnapshot(snapshot, meta, '2026-03-28T12:01:00.000000Z'),
        ).toBe(false);
    });

    it('solo reutiliza snapshots vacíos cuando no hay timestamp remoto ni local', () => {
        expect(
            canReuseListingSnapshot({ total_items: 0, items: [] }, null, null),
        ).toBe(true);
        expect(
            canReuseListingSnapshot({ total_items: 2, items: [{ id: 1 }] }, null, null),
        ).toBe(false);
    });
});

describe('listingCacheRepository.cjs', () => {
    it('construye e hidrata snapshots con ids e items serializados', () => {
        const entry = buildListingCacheEntry({
            entity: 'clients',
            cacheKey: 'list::status:activo',
            mode: 'list',
            page: 2,
            params: { status: 'activo' },
            itemIds: [4, 7],
            items: [{ id: 4 }, { id: 7 }],
            totalPages: 3,
            totalItems: 55,
            perPage: 30,
        });

        const hydrated = hydrateListingCacheRow(entry);

        expect(hydrated.id).toBe('clients::list::status:activo::2');
        expect(hydrated.params).toEqual({ status: 'activo' });
        expect(hydrated.itemIds).toEqual([4, 7]);
        expect(hydrated.items).toEqual([{ id: 4 }, { id: 7 }]);
        expect(hydrated.total_pages).toBe(3);
        expect(hydrated.total_items).toBe(55);
        expect(hydrated.per_page).toBe(30);
    });
});
