const { getAll, upsertMany } = require('./database.cjs');
const {
    getTemplatesLastModifiedFromApi,
    listTemplatesByCategoryFromApi,
    listTemplatesFromApi,
} = require('./templatesApi.cjs');
const {
    buildListingCacheEntry,
    clearListingQueryCache,
    getCachedListingPage,
    getListingMeta,
    setListingMeta,
    upsertCachedListingPage,
} = require('./listingCacheRepository.cjs');
const {
    buildCacheKey,
    canReuseListingSnapshot,
    buildListingResponse,
    buildPaginatedResponseFromItems,
    extractCollection,
    extractPaginationMeta,
    isOfflineLikeError,
    parseJsonSafely,
} = require('./listingBackendUtils.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('templates:listing:service');
const TEMPLATES_LISTING_ENTITY = 'templates';
const TEMPLATES_DEFAULT_PER_PAGE = 40;

function hydrateTemplateRow(row) {
    if (!row || typeof row !== 'object') return null;
    const payload = parseJsonSafely(row.data_json);
    return payload ? { ...row, ...payload } : row;
}

function buildTemplateCacheRow(template, existingTemplate = null) {
    const fallback = hydrateTemplateRow(existingTemplate);
    const normalized = template && typeof template === 'object' ? template : {};
    const templateId = Number(normalized.id ?? fallback?.id);

    if (!Number.isInteger(templateId) || templateId < 1) {
        throw new Error('No se pudo construir la fila de caché de la plantilla sin un id válido.');
    }

    const merged = {
        ...(fallback || {}),
        ...normalized,
        id: templateId,
    };

    return {
        id: templateId,
        title: merged.title ?? null,
        template_category_id: merged.template_category_id ?? null,
        data_json: JSON.stringify(merged),
        synced_at: new Date().toISOString(),
    };
}

function listCachedTemplates() {
    return getAll('templates').map(hydrateTemplateRow).filter(Boolean);
}

function upsertCachedTemplates(templates = []) {
    if (!Array.isArray(templates) || templates.length === 0) return;

    const existingTemplates = new Map(getAll('templates').map((row) => [String(row.id), row]));
    const rows = templates.map((template) =>
        buildTemplateCacheRow(template, existingTemplates.get(String(template?.id)) || null)
    );

    upsertMany('templates', rows);
}

function buildCategoryNameMap() {
    return new Map(
        getAll('template_categories')
            .map((row) => {
                const payload = parseJsonSafely(row.data_json);
                const category = payload ? { ...row, ...payload } : row;
                return [String(category.id), category.name || ''];
            }),
    );
}

function normalizeFilters(rawFilters = {}) {
    const categoryId = String(rawFilters.categoryId ?? rawFilters.selectedCategory ?? 'all').trim();

    return {
        searchTerm: typeof rawFilters.searchTerm === 'string' ? rawFilters.searchTerm.trim() : '',
        categoryId: categoryId || 'all',
    };
}

function matchesTemplateSearch(template, searchTerm, categoryNames) {
    if (!searchTerm) return true;
    const normalizedSearch = searchTerm.toLowerCase();
    const categoryName = categoryNames.get(String(template?.template_category_id)) || '';

    return [
        template?.title,
        categoryName,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

function matchesTemplateFilters(template, filters, categoryNames) {
    if (!template || typeof template !== 'object') return false;
    if (filters.categoryId !== 'all' && String(template.template_category_id) !== String(filters.categoryId)) return false;
    if (!matchesTemplateSearch(template, filters.searchTerm, categoryNames)) return false;
    return true;
}

function buildRemoteQuery(page, filters) {
    return {
        page,
        ...(filters.searchTerm ? { search: filters.searchTerm } : {}),
    };
}

function buildOfflineTemplatesResponse(page, filters, source = 'cache-reconstructed') {
    const categoryNames = buildCategoryNameMap();
    const filteredTemplates = listCachedTemplates()
        .filter((template) => matchesTemplateFilters(template, filters, categoryNames))
        .sort((left, right) => String(left?.title || '').localeCompare(String(right?.title || ''), 'es'));

    return buildPaginatedResponseFromItems({
        items: filteredTemplates,
        page,
        perPage: TEMPLATES_DEFAULT_PER_PAGE,
        source,
        appliedLocalFilters: Boolean(filters.searchTerm || filters.categoryId !== 'all'),
    });
}

async function getTemplateListingPage(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const filters = normalizeFilters(options.filters);
    const cacheKey = buildCacheKey(filters.categoryId === 'all' ? 'list' : 'category', {
        categoryId: filters.categoryId,
        searchTerm: filters.searchTerm,
    });
    const snapshot = getCachedListingPage(TEMPLATES_LISTING_ENTITY, cacheKey, page);
    const listingMeta = getListingMeta(TEMPLATES_LISTING_ENTITY);
    let lastServer = listingMeta?.last_server ?? null;

    if (snapshot) {
        try {
            const lastModifiedResponse = await getTemplatesLastModifiedFromApi();
            if (!lastModifiedResponse.ok) {
                if (isOfflineLikeError(lastModifiedResponse)) {
                    return buildOfflineTemplatesResponse(page, filters);
                }

                logger.warn('templates listing last-modified failed before reusing snapshot', {
                    status: lastModifiedResponse.status,
                    error: lastModifiedResponse.error || null,
                    data: lastModifiedResponse.data,
                    page,
                });
            } else {
                lastServer = lastModifiedResponse.data?.last_modified ?? null;
                if (canReuseListingSnapshot(snapshot, listingMeta, lastServer)) {
                    return buildOfflineTemplatesResponse(page, filters, 'cache-validated');
                }
            }
        } catch (error) {
            logger.warn('templates listing could not read last-modified before revalidation', {
                error: error?.message || String(error),
                page,
            });
        }
    }

    const response = filters.categoryId === 'all'
        ? await listTemplatesFromApi(buildRemoteQuery(page, filters))
        : await listTemplatesByCategoryFromApi(filters.categoryId, buildRemoteQuery(page, filters));

    if (!response.ok) {
        if (isOfflineLikeError(response)) {
            return buildOfflineTemplatesResponse(page, filters);
        }

        throw new Error(response.error || 'No se pudo obtener el listado de modelos.');
    }

    const items = extractCollection(response.data);
    const meta = extractPaginationMeta(response.data, TEMPLATES_DEFAULT_PER_PAGE);

    void Promise.resolve().then(() => {
        upsertCachedTemplates(items);
        upsertCachedListingPage(buildListingCacheEntry({
            entity: TEMPLATES_LISTING_ENTITY,
            cacheKey,
            mode: filters.categoryId === 'all' ? 'list' : 'category',
            page,
            params: filters,
            itemIds: items.map((item) => Number(item.id)).filter(Number.isFinite),
            totalPages: meta.lastPage,
            totalItems: meta.total ?? items.length,
            perPage: meta.perPage,
        }));

        if (lastServer !== undefined) {
            setListingMeta(TEMPLATES_LISTING_ENTITY, new Date().toISOString(), lastServer);
        }
    }).catch((error) => {
        logger.warn('failed to persist templates listing snapshot', {
            cacheKey,
            page,
            error: error?.message || String(error),
        });
    });

    return buildListingResponse({
        items,
        page: meta.currentPage,
        total: meta.total ?? items.length,
        totalPages: meta.lastPage,
        perPage: meta.perPage,
        source: 'api',
        appliedLocalFilters: false,
    });
}

async function invalidateTemplateListingCache() {
    clearListingQueryCache(TEMPLATES_LISTING_ENTITY);
    setListingMeta(TEMPLATES_LISTING_ENTITY, new Date().toISOString(), null);
    return { ok: true };
}

module.exports = {
    getTemplateListingPage,
    invalidateTemplateListingCache,
};
