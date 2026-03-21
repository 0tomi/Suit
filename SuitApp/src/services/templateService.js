import { apiGet, apiRequest } from './api.js';

export async function getTemplates({ page = 1 } = {}) {
    const result = await apiGet('/templates', { params: { page } });
    return result.ok ? result.data : { data: [] };
}

export async function getTemplate(id) {
    const result = await apiGet(`/templates/${id}`);
    return result.ok ? result.data : null;
}

export async function deleteTemplate(id) {
    return await apiRequest(`/templates/${id}`, { method: 'DELETE' });
}

export async function getTemplatesLastModified() {
    const result = await apiGet('/templates/last-modified');
    return result.ok ? result.data?.last_modified : null;
}

export async function getTemplateCategories() {
    const result = await apiGet('/template-categories');
    return result.ok ? result.data : { data: [] };
}

export async function createTemplateCategory(data) {
    return await apiRequest('/template-categories', {
        method: 'POST',
        body: data,
    });
}

export async function getTemplateCategoriesLastModified() {
    const result = await apiGet('/template-categories/last-modified');
    return result.ok ? result.data?.last_modified : null;
}
