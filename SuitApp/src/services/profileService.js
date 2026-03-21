/**
 * profileService.js — Servicio de perfil del usuario autenticado.
 * Endpoints: PUT /user/profile  |  POST /user/profile-photo
 */
import { apiRequest } from './api.js';

/**
 * Actualiza el nombre, apellido, email y/o contraseña del usuario autenticado.
 * @param {{ name?: string, last_name?: string, email?: string, password?: string }} data
 * @returns {Promise<{ ok: boolean, user?: object, error?: string }>}
 */
export async function updateProfile(data) {
    const result = await apiRequest('/user/profile', {
        method: 'PUT',
        body: data,
    });
    if (result.ok && result.data) {
        return { ok: true, user: result.data };
    }
    return { ok: false, error: result.data?.message || 'Error al actualizar el perfil.' };
}

/**
 * Sube una foto de perfil (PNG o JPG) y la asocia al usuario autenticado.
 * @param {File} file
 * @returns {Promise<{ ok: boolean, user?: object, error?: string }>}
 */
export async function uploadProfilePhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);

    const result = await apiRequest('/user/profile-photo', {
        method: 'POST',
        body: formData,
    });
    if (result.ok && result.data) {
        return { ok: true, user: result.data };
    }
    return { ok: false, error: result.data?.message || 'Error al subir la foto de perfil.' };
}

/**
 * Construye la URL pública de la foto de perfil de un usuario dado el path.
 * Si no hay path, retorna null.
 * @param {string|null} profilePhotoPath
 * @param {string} apiBase - Base URL de la API (sin /api)
 * @returns {string|null}
 */
export function getProfilePhotoUrl(profilePhotoPath, apiBase) {
    if (!profilePhotoPath || !apiBase) return null;
    // apiBase es http://host:port/api → necesitamos http://host:port/storage/...
    const storageBase = apiBase.replace(/\/api$/, '');
    return `${storageBase}/storage/${profilePhotoPath}`;
}
