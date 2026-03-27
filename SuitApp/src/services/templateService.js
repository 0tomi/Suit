import { apiGet, apiRequest } from './api.js';

export async function getTemplates({ page = 1 } = {}) {
    const result = await apiGet('/templates', { params: { page } });
    return result.ok ? result.data : { data: [] };
}

export async function getTemplate(id) {
    const result = await apiGet(`/templates/${id}`);
    return result.ok ? result.data : null;
}

/**
 * Crea una nueva plantilla con sus requisitos opcionales.
 * @param {{ title: string, content: string, template_category_id?: number, requirements?: Array<{id_requisito: number, id_campo: number}> }} data
 */
export async function createTemplate(data) {
    return await apiRequest('/templates', { method: 'POST', body: data });
}

/**
 * Actualiza una plantilla existente.
 * Si se incluye el array requirements, reemplaza todos los requisitos vinculados.
 * @param {number} id
 * @param {{ title?: string, content?: string, template_category_id?: number, requirements?: Array<{id_requisito: number, id_campo: number}> }} data
 */
export async function updateTemplate(id, data) {
    return await apiRequest(`/templates/${id}`, { method: 'PUT', body: data });
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

/**
 * Obtiene el timestamp de la última modificación de los requisitos de una plantilla.
 * Se usa para validar si la caché local de plantilla_requisitos está vigente.
 * @param {number} templateId
 * @returns {Promise<string|null>} timestamp o null si falla
 */
export async function getTemplateRequirementsLastModified(templateId) {
    const result = await apiGet(`/templates/${templateId}/requirements/last-modified`);
    return result.ok ? result.data?.last_modified : null;
}
