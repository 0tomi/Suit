import { syncResource } from './syncCore.js';
import { getTemplateCategories, getTemplates } from '../templateService.js';

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

function extractMeta(payload) {
    if (payload?.meta) return payload.meta;
    if (payload?.data?.meta) return payload.data.meta;
    return null;
}

export async function syncTemplates() {
    return await syncResource('templates', '/templates/last-modified', fetchAndCacheTemplates);
}

export async function syncTemplateCategories() {
    return await syncResource('template_categories', '/template-categories/last-modified', fetchAndCacheTemplateCategories);
}

async function fetchAndCacheTemplates() {
    let allTemplates = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const result = await getTemplates({ page });
        const currentData = extractCollection(result);
        if (currentData.length === 0) break;

        allTemplates = allTemplates.concat(currentData);

        const meta = extractMeta(result);
        if (meta && meta.current_page < meta.last_page) {
            page += 1;
        } else {
            hasMore = false;
        }
    }

    const rows = allTemplates.map((template) => ({
        id: template.id,
        title: template.title || null,
        template_category_id: template.template_category_id ?? null,
        data_json: JSON.stringify(template),
        synced_at: new Date().toISOString(),
    }));

    await window.electronAPI.db.clearTable('templates');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('templates', rows);
    }
}

async function fetchAndCacheTemplateCategories() {
    const categories = extractCollection(await getTemplateCategories());
    const rows = categories.map((category) => ({
        id: category.id,
        name: category.name || null,
        description: category.description || null,
        data_json: JSON.stringify(category),
        synced_at: new Date().toISOString(),
    }));

    await window.electronAPI.db.clearTable('template_categories');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('template_categories', rows);
    }
}

export default {
    syncTemplates,
    syncTemplateCategories,
};
